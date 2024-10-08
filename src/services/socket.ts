import { Boom } from '@hapi/boom';
import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    WASocket,
    ConnectionState,
    delay,
    Browsers,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import NodeCache from 'node-cache';
import * as QRCode from 'qrcode';
import fs from 'fs/promises';
import path from 'path';
import logger from '../helpers/logger';
import { SpAccount, SpAccountRepository } from '../repository/sp_accounts';
import { InstanceRepository, Instance } from '../repository/sp_whatsapp_sessions';
import { splitAndModifyWhatsappString } from '../utils/splitAndModifyWhatsappString';
import moment from 'moment';

class SocketService {
    private sockets: Map<string, WASocket> = new Map();
    private qrCache: NodeCache;
    private reconnectAttempts: Map<string, number> = new Map();
    private connectionTimers: Map<string, NodeJS.Timeout> = new Map();
    private sessionTimeoutTimers: Map<string, NodeJS.Timeout> = new Map();

    private accountRepo: SpAccountRepository;
    private instanceRepo: InstanceRepository;

    private static readonly RECONNECT_INTERVAL = 3000;
    private static readonly SESSION_TIMEOUT = 15 * 60 * 1000;
    private static readonly QR_TTL = 300;

    constructor() {
        this.qrCache = new NodeCache({ stdTTL: SocketService.QR_TTL, checkperiod: 60 });
        this.accountRepo = new SpAccountRepository();
        this.instanceRepo = new InstanceRepository();
    }

    async connect(sessionId: string, _type: "getQR" | "default" = "default"): Promise<WASocket> {
        if (this.sockets.has(sessionId) && this.isConnected(sessionId)) {
            logger.warn(`Socket for session ${sessionId} is already open. Skipping connection.`);
            return this.sockets.get(sessionId)!;
        }

        try {
            const { state, saveCreds } = await useMultiFileAuthState(`sessions/${sessionId}`);
            const socket = makeWASocket({
                browser: Browsers.macOS('Chrome'),
                logger: pino({ level: "silent" }),
                printQRInTerminal: false,
                qrTimeout: 12000,
                defaultQueryTimeoutMs: 30000,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
                },
                generateHighQualityLinkPreview: true,
            });

            this.sockets.set(sessionId, socket);
            this.setupEventListeners(sessionId, saveCreds);

            return socket;
        } catch (error) {
            logger.error(`Failed to connect for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(`Connection failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private setupEventListeners(sessionId: string, saveCreds: () => Promise<void>): void {
        const socket = this.sockets.get(sessionId);
        if (!socket) return;

        socket.ev.on('connection.update', (update) => this.handleConnectionUpdate(sessionId, update));
        socket.ev.on('creds.update', saveCreds);
    }

    private async handleConnectionUpdate(sessionId: string, update: Partial<ConnectionState>): Promise<void> {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            await this.handleQR(sessionId, qr);
        }

        switch (connection) {
            case 'close':
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut
                    && statusCode !== DisconnectReason.timedOut
                    && statusCode !== DisconnectReason.badSession
                    && statusCode !== 405;

                if (shouldReconnect) {
                    await this.handleReconnection(sessionId);
                } else {
                    logger.info(`Session ${sessionId} logged out. Cleaning up...`);
                    await this.cleanupSession(sessionId);
                }
                break
            case 'open':
                await this.processNewConnection(sessionId);
                this.setupSessionTimeout(sessionId);
                logger.info(`Connection opened successfully for session ${sessionId}`);
                this.reconnectAttempts.set(sessionId, 0);
                break
            default:
                console.log("from Deafult Case");

        }
    }

    private setupSessionTimeout(sessionId: string): void {
        this.clearSessionTimeout(sessionId);
        const timer = setTimeout(() => {
            this.endSession(sessionId);
        }, SocketService.SESSION_TIMEOUT);
        this.sessionTimeoutTimers.set(sessionId, timer);
    }

    private clearSessionTimeout(sessionId: string): void {
        const timer = this.sessionTimeoutTimers.get(sessionId);
        if (timer) {
            clearTimeout(timer);
            this.sessionTimeoutTimers.delete(sessionId);
        }
    }

    private async handleReconnection(sessionId: string): Promise<void> {
        const attempts = (this.reconnectAttempts.get(sessionId) || 0) + 1;
        this.reconnectAttempts.set(sessionId, attempts);
        logger.info(`Attempting to reconnect (attempt ${attempts}) for session ${sessionId}`);
        this.clearConnectionTimer(sessionId);
        const timer = setTimeout(() => {
            this.connect(sessionId);
        }, SocketService.RECONNECT_INTERVAL);
        this.connectionTimers.set(sessionId, timer);
    }

    private clearConnectionTimer(sessionId: string): void {
        const timer = this.connectionTimers.get(sessionId);
        if (timer) {
            clearTimeout(timer);
            this.connectionTimers.delete(sessionId);
        }
    }

    private async handleQR(sessionId: string, qr: string): Promise<void> {
        try {
            const qrBase64 = await QRCode.toDataURL(qr);
            this.qrCache.set(sessionId, qrBase64);
            logger.info(`QR code generated and cached for session ${sessionId}`);
        } catch (error) {
            logger.error(`Error generating QR code for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async cleanupSession(sessionId: string): Promise<void> {
        try {
            await this.instanceRepo.delete(sessionId);
            await this.accountRepo.update(sessionId, { status: 0 })
            const sessionPath = path.join('sessions', sessionId);
            await fs.rm(sessionPath, { recursive: true, force: true });
            logger.info(`Cleaned up session directory for ${sessionId}`);
        } catch (error) {
            logger.error(`Error cleaning up session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
        }

        this.qrCache.del(sessionId);
        this.sockets.delete(sessionId);
        this.clearConnectionTimer(sessionId);
        this.clearSessionTimeout(sessionId);
    }

    private endSession(sessionId: string): void {
        const socket = this.sockets.get(sessionId);
        if (socket) {
            socket.end(new Error(`Session ${sessionId} timed out`));
            logger.info(`Ended session ${sessionId} due to timeout`);
            this.cleanupSession(sessionId);
        }
    }

    async getQR(sessionId: string, type: "code" | "qr" = "qr", number?: string): Promise<string | null> {
        if (this.isConnected(sessionId)) {
            throw new Error(`Connection Already Opened!`);
        }

        await delay(2000);
        const cachedQR = this.qrCache.get<string>(sessionId);
        if (cachedQR && type === "qr") {
            return cachedQR;
        }

        if (!this.sockets.has(sessionId)) {
            await this.connect(sessionId);
        }

        const socket = this.sockets.get(sessionId);
        if (socket && type === "code" && number) {
            return await socket.requestPairingCode(number);
        }

        return null;
    }

    async sendMessage(sessionId: string, to: string, message: string): Promise<void> {
        const socket = this.sockets.get(sessionId);
        if (!socket) {
            throw new Error('Socket is not connected');
        }

        try {
            await socket.sendMessage(to, { text: message });
        } catch (error) {
            logger.error(`Failed to send message: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(`Message sending failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async logout(sessionId: string): Promise<{ status: string, message: string }> {
        await this.instanceRepo.delete(sessionId);
        await this.accountRepo.updateViaToken(sessionId, { status: 0 });
        const socket = this.sockets.get(sessionId);

        if (socket) {
            try {
                await socket.logout();
                await this.cleanupSession(sessionId);
                logger.info(`Disconnected successfully for session ${sessionId}`);
            } catch (error) {
                logger.error(`Error during disconnect for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
                throw new Error(`Disconnect failed: ${error instanceof Error ? error.message : String(error)}`);
            } finally {
                return { status: 'success', message: 'Success' };
            }
        }

        // If the socket doesn't exist, return a failure message
        logger.warn(`Socket not found for session ${sessionId}`);
        return { status: 'failed', message: 'Socket not found' };
    }

    isConnected(sessionId: string): boolean {
        const socket = this.sockets.get(sessionId);
        return socket?.user !== undefined;
    }

    clearAllCaches(): void {
        this.qrCache.flushAll();
        logger.info('All caches cleared');
    }

    getConnectionStatus(sessionId: string): string {
        const socket = this.sockets.get(sessionId);
        return socket ? (this.isConnected(sessionId) ? 'connected' : 'connecting') : 'disconnected';
    }

    getSessionInfo(sessionId: string): { sessionId: string; reconnectAttempts: number } {
        return {
            sessionId,
            reconnectAttempts: this.reconnectAttempts.get(sessionId) || 0
        };
    }

    async processNewConnection(sessionId: string): Promise<void> {
        try {
            const socket = this.sockets.get(sessionId);
            if (!socket) throw new Error(`Socket not found for session ${sessionId}`);

            const sessionUpdate: Partial<Instance> = {
                status: 1,
                data: JSON.stringify({
                    phone: socket.user ? splitAndModifyWhatsappString(socket.user.id) : '',
                    name: socket.user?.name,
                })
            };

            await this.instanceRepo.update(sessionId, sessionUpdate);
            await this.accountRepo.updateViaToken(sessionId, { status: 1 });

            const imgUrl = await this.getUserInfo(socket);
            if (imgUrl) {
                await this.instanceRepo.update(sessionId, {
                    data: JSON.stringify({
                        ...JSON.parse(sessionUpdate.data || '{}'),
                        avatar: imgUrl
                    })
                });
            }

            const teamId = await this.getTeamId(sessionId);

            if (teamId) {
                await this.addAccount(sessionId, teamId, socket.user);
            }

            logger.info(`New connection processed for instance ${sessionId}`);
        } catch (error) {
            logger.error(`Error processing new connection for instance ${sessionId}:`, error);
        }
    }

    private async getUserInfo(socket: WASocket): Promise<string | null> {
        try {
            const imgUrl = await socket.profilePictureUrl(socket.user!.id, "image");
            return imgUrl || null;
        } catch (error) {
            logger.error('Error fetching user info:', error);
            return null;
        }
    }

    private async getTeamId(sessionId: string): Promise<number | null> {
        const instance = await this.instanceRepo.findByInstanceId(sessionId);
        return instance?.team_id || null;
    }

    private async addAccount(instanceId: string, teamId: number, waInfo: any): Promise<void> {
        const account = await this.accountRepo.findByInstanceID(instanceId);
        const userAvatar = await this.getUserInfo(this.sockets.get(instanceId)!);

        if (!account) {
            await this.createNewAccount(instanceId, teamId, waInfo, userAvatar);
        } else {
            await this.updateExistingAccount(instanceId, waInfo, account, userAvatar);
        }
    }


    private async createNewAccount(instanceId: string, teamId: number, waInfo: any, userAvatar: string | null): Promise<void> {
        const newAccountData: SpAccount = {
            ids: this.makeId(13),
            module: 'whatsapp_profiles',
            social_network: 'whatsapp',
            category: 'profile',
            login_type: 2,
            can_post: 0,
            team_id: teamId,
            pid: splitAndModifyWhatsappString(waInfo.id.toString()),
            name: waInfo.name,
            username: splitAndModifyWhatsappString(waInfo.id.toString()),
            token: instanceId,
            avatar: userAvatar || '',
            url: 'https://web.whatsapp.com/',
            tmp: JSON.stringify(waInfo),
            status: 1,
            changed: moment().unix(),
            created: moment().unix(),
        };

        // Call the 'create' method from accountRepo to insert the new account
        await this.accountRepo.create(newAccountData);
    }

    private async updateExistingAccount(instanceId: string, waInfo: any, account: any, userAvatar: string | null): Promise<void> {
        const updateData = {
            pid: splitAndModifyWhatsappString(waInfo.id.toString()),
            name: waInfo.name,
            username: splitAndModifyWhatsappString(waInfo.id.toString()),
            token: instanceId,
            avatar: userAvatar || account.avatar,
            tmp: JSON.stringify(waInfo),
            status: 1,
            changed: moment().unix(),
        };
        await this.accountRepo.updateById(account.id, updateData);
    }

    private makeId(length: number): string {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }
}

export const socketService = new SocketService();
import { SpAccountRepository } from '../repository/sp_accounts';
import { socketService } from './socket';
import logger from '../helpers/logger';
import { performance } from 'perf_hooks';

export class CronJobs {
    private accountRepo: SpAccountRepository;
    private batchSize: number = 10;

    constructor() {
        this.accountRepo = new SpAccountRepository();
    }

    async startInstances(): Promise<void> {
        const startTime = performance.now();
        let totalAccounts = 0;
        let startedAccounts = 0;
        let failedAccounts = 0;

        try {
            const activeAccounts = await this.accountRepo.findByStatus(1);
            totalAccounts = activeAccounts.length;
            logger.info(`Total active accounts: ${totalAccounts}`);

            for (let i = 0; i < activeAccounts.length; i += this.batchSize) {
                const batch = activeAccounts.slice(i, i + this.batchSize);
                const results = await Promise.all(
                    batch.map(account => this.startInstance(account.token))
                );

                startedAccounts += results.filter(r => r).length;
                failedAccounts += results.filter(r => !r).length;

                logger.info(`Progress: ${i + batch.length}/${totalAccounts} accounts processed`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            logger.error(`Error in CronJobs.startInstances: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            const endTime = performance.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            logger.info(`
                CronJob Summary:
                Total Accounts: ${totalAccounts}
                Started Successfully: ${startedAccounts}
                Failed to Start: ${failedAccounts}
                Duration: ${duration} seconds
            `);
        }
    }

    private async startInstance(token: string): Promise<boolean> {
        try {
            await socketService.connect(token);
            logger.info(`Started instance for account with token: ${token}`);
            return true;
        } catch (error) {
            logger.error(`Failed to start instance for account with token ${token}: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    async monitorConnections(): Promise<void> {
        try {
            const connectedAccounts = await this.accountRepo.countByStatus(1);
            const disconnectedAccounts = await this.accountRepo.countByStatus(0);
            const totalAccounts = connectedAccounts + disconnectedAccounts;

            logger.info(`
    📊 Connection Status 📊
    ✅ Connected Accounts: ${connectedAccounts}
    ❌ Disconnected Accounts: ${disconnectedAccounts}
    👥 Total Accounts: ${totalAccounts}
        `);
        } catch (error) {
            logger.error(`🚨 Error in CronJobs.monitorConnections: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

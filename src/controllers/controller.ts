import { Request, Response } from 'express';
import { getQueryParams, sendErrorResponse } from '../helpers/request';
import { InstanceService } from '../services/instance';
import { socketService } from '../services/socket';

// Initialize instance service
const instanceService = new InstanceService();

// Main Codes
export const helloWorld = (_req: Request, res: Response): void => {
    res.json({ message: 'Hello, World!' });
};

export const instance = async (req: Request, res: Response): Promise<void> => {
    try {
        const query = getQueryParams(req);
        const instanceId = query.instance_id as string;
        const accessToken = query.access_token as string;
        const phoneNumber = query.phone as string;
        const type = (query.type as "qr" | "paircode" | "logout" | "default") || "default";


        if (!instanceId) {
            throw new Error('instance_id is required');
        }

        const socket = await socketService.connect(instanceId, "getQR");

        if (type === "logout" && socket) {
            const response = await socketService.logout(instanceId);
            res.json(response);
            return;
        }

        if (!accessToken) {
            throw new Error('accessToken is required');
        }

        const result = await instanceService.validateUser(instanceId, accessToken);

        if (!result) {
            throw new Error("Ohh! Something went wrong on Instance");
        }


        if (type === "qr" && socket) {
            const qrCode = await socketService.getQR(instanceId, "qr");
            if (qrCode) {
                res.json({ status: 'success', message: 'Success', base64: qrCode });
            } else {
                throw new Error("Failed to generate QR code");
            }
            return;
        } else if (type === "paircode" && socket) {
            if (!phoneNumber) {
                throw new Error("Phone number is required for paircode");
            }
            const code = await socketService.getQR(instanceId, "code", phoneNumber);

            if (code) {
                const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;
                res.json({ status: 'success', message: 'Success', code: formattedCode });
            } else {
                throw new Error("Failed to generate pair code");
            }
            return;
        }

        res.json({ success: true, data: result });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error in Instance';
        sendErrorResponse(res, new Error(errorMessage), 500);
    }
};

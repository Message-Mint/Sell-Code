import { Request, Response, NextFunction } from 'express';
import { ValidationError } from 'express-validation';

// Helper to get query parameters
export const getQueryParams = (req: Request) => {
    return req.query;
};

// Helper to get body data
export const getBodyData = (req: Request) => {
    return req.body;
};

// Helper to send a success response
export const sendSuccessResponse = (res: Response, data: any, message = 'Success') => {
    return res.status(200).json({ status: 'success', message, data });
};

// Helper to send an error response
export const sendErrorResponse = (res: Response, error: Error, statusCode = 400) => {
    return res.status(statusCode).json({ status: 'error', message: error?.message || error || "Internal Server error!" });
};

type FieldValidator = (value: any) => boolean | string;

interface FieldConfig {
    validator?: FieldValidator;
    required?: boolean;
    errorMessage?: string;
}

type FieldsConfig = Record<string, FieldConfig | FieldValidator>;


export const validateBodyFields = (fieldsConfig: FieldsConfig) => {
    return (req: Request, res: Response, next: NextFunction): void | Response => {
        const errors: string[] = [];

        for (const [field, config] of Object.entries(fieldsConfig)) {
            const value = req.body[field];
            const fieldConfig: FieldConfig = typeof config === 'function' ? { validator: config } : config;
            const { validator, required = true, errorMessage } = fieldConfig;

            if (required && (value === undefined || value === null || value === '')) {
                errors.push(errorMessage || `Missing required field: ${field}`);
                continue;
            }

            if (validator && value !== undefined) {
                const validationResult = validator(value);
                if (validationResult !== true) {
                    errors.push(typeof validationResult === 'string' ? validationResult : `Invalid value for field: ${field}`);
                }
            }
        }

        if (errors.length > 0) {
            return sendErrorResponse(res, new Error(errors.join('; ')), 400);
        }

        next();
    };
};

// Helper to log request details
export const logRequestDetails = (req: Request) => {
    console.log(`Received ${req.method} request for '${req.url}'`);
};

interface AdditionalParams {
    [key: string]: string;
}

export const validateQueryParams = (requiredFields: string[], additionalParams: AdditionalParams = {}) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        for (const field of requiredFields) {
            if (!req.query[field]) {
                sendErrorResponse(res, new Error(`Missing required query parameter: ${field}`), 400);
                return;
            }
        }

        // Add additional parameters with default values if not present
        for (const [key, defaultValue] of Object.entries(additionalParams)) {
            if (!req.query[key]) {
                req.query[key] = defaultValue;
            }
        }

        next();
    };
};

// Helper to handle validation errors
export const handleValidationError = (res: Response, error: ValidationError) => {
    return sendErrorResponse(res, new Error(error.message), 422);
};

// Helper to send a not found response
export const sendNotFoundResponse = (res: Response, message = 'Resource not found') => {
    return res.status(404).json({ status: 'error', message });
};

// Helper for middleware to authenticate requests (dummy implementation)
export const authenticateRequest = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers['authorization'];
    if (!token) {
        return sendErrorResponse(res, new Error('Unauthorized access'), 401);
    }
    // Implement your actual authentication logic here (e.g., JWT verification)
    next();
    return;
};

// Helper to send a response with pagination metadata
export const sendPaginatedResponse = (
    res: Response,
    data: any[],
    total: number,
    page: number,
    limit: number,
    message = 'Success'
) => {
    return res.status(200).json({
        status: 'success',
        message,
        data,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    });
};

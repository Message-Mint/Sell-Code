import express, { Application, Request, Response, NextFunction } from 'express';
import path from 'path';
import routes from './routes';
import logger from './helpers/logger';
import cors from 'cors'; // Import CORS middleware
import dotenv from 'dotenv'; // Import dotenv
import * as cron from 'node-cron';
import { CronJobs } from './services/cron_jobs';

// Load environment variables from .env file
dotenv.config();

const app: Application = express();

// CORS configuration
const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*', // Use environment variable or default to '*'
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions)); // Use CORS middleware with the specified options

// Serve static files from the public directory
app.use(express.static(path.join('public')));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route to send HTML file for the root path
app.get('/', (_req: Request, res: Response) => {
    res.sendFile(path.join('public', 'index.html'));
});

app.use('/', routes);

// Basic error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error(err.message);  // Log the error message
    res.status(500).send('Something went wrong!');
});



// Cron Job 
const cronJobs = new CronJobs();

export async function startCronJobs() {
    try {
        await cronJobs.startInstances();
        logger.info('🚀 Cron job instances initialized successfully');
    } catch (error) {
        logger.error('❌ Failed to initialize cron job instances:', error);
    }

    cron.schedule('*/1 * * * *', async () => {
        const jobName = 'Monitor Connections';
        const startTime = new Date().toISOString();

        logger.info(`⏳ [${startTime}] Starting cron job: ${jobName}`);

        try {
            await cronJobs.monitorConnections();
            const endTime = new Date().toISOString();
            logger.info(`✅ [${endTime}] Cron job completed: ${jobName}`);
        } catch (error) {
            const errorTime = new Date().toISOString();
            logger.error(
                `❌ [${errorTime}] Error in cron job ${jobName}:`,
                error
            );
        }
    });

    logger.info('🕒 Cron jobs scheduled and running');
}

export default app;

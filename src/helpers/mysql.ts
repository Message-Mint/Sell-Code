import mysql, { ConnectionOptions, Pool, PoolConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
import logger from './logger';

dotenv.config();

export class MySQLConnectionManager {
    private static instance: MySQLConnectionManager;
    private pool: Pool | null = null;
    private connectionOptions: ConnectionOptions;

    private constructor() {
        this.connectionOptions = this.loadConnectionOptions();
    }

    private loadConnectionOptions(): ConnectionOptions {
        return {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: Number(process.env.DB_PORT) || 3306,
            connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
            queueLimit: Number(process.env.DB_QUEUE_LIMIT) || 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 10000,
        };
    }

    public static getInstance(): MySQLConnectionManager {
        if (!MySQLConnectionManager.instance) {
            MySQLConnectionManager.instance = new MySQLConnectionManager();
        }
        return MySQLConnectionManager.instance;
    }

    private async createPool(): Promise<Pool> {
        if (!this.pool) {
            try {
                this.pool = mysql.createPool(this.connectionOptions);
                logger.info('MySQL connection pool created');
            } catch (error) {
                logger.error('Error creating MySQL connection pool:', error);
                throw error;
            }
        }
        return this.pool;
    }

    public async getConnection(): Promise<PoolConnection> {
        const pool = await this.createPool();
        try {
            return await pool.getConnection();
        } catch (error) {
            logger.error('Error getting connection from pool:', error);
            throw error;
        }
    }

    public async query<T>(sql: string, values?: any[]): Promise<T> {
        const conn = await this.getConnection();
        try {
            const [results] = await conn.query(sql, values);
            return results as T;
        } catch (error) {
            logger.error('Error executing query:', error);
            throw error;
        } finally {
            conn.release();
        }
    }

    public async transaction<T>(callback: (connection: PoolConnection) => Promise<T>): Promise<T> {
        const conn = await this.getConnection();
        try {
            await conn.beginTransaction();
            const result = await callback(conn);
            await conn.commit();
            return result;
        } catch (error) {
            await conn.rollback();
            logger.error('Transaction error:', error);
            throw error;
        } finally {
            conn.release();
        }
    }

    public async close(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            logger.info('MySQL connection pool closed');
        }
    }
}

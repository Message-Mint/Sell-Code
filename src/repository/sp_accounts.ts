import { MySQLConnectionManager } from '../helpers/mysql';

export interface SpAccount {
    avatar: string;
    can_post: number;
    category: string;
    changed: number;
    created: number;
    data?: string;
    id?: number;
    ids: string;
    login_type: number;
    module: string;
    name: string;
    pid: string;
    proxy?: string;
    social_network: string;
    status: number;
    team_id: number;
    tmp: string;
    token: string;
    url: string;
    username: string;
}

export class SpAccountRepository {
    private db: MySQLConnectionManager;

    constructor() {
        this.db = MySQLConnectionManager.getInstance();
    }

    async findByInstanceID(InstanceID: string): Promise<SpAccount | null> {
        const [item] = await this.db.query<SpAccount[]>('SELECT * FROM sp_accounts WHERE token = ?', [InstanceID]);
        return item || null;
    }

    async findAll(): Promise<SpAccount[]> {
        return this.db.query<SpAccount[]>('SELECT * FROM sp_accounts');
    }

    async create(item: SpAccount): Promise<number | unknown> {
        try {
            const result = await this.db.query<{ insertId: number }>('INSERT INTO sp_accounts SET ?', [item]);
            return result.insertId || result;
        } catch (error) {
            console.error('Error inserting into sp_accounts:', error);
            throw error;
        }
    }

    async update(instanceId: string, item: Partial<Omit<SpAccount, "id">>): Promise<void> {
        await this.db.query('UPDATE sp_accounts SET ? WHERE token = ?', [item, instanceId]);
    }
    async updateById(id: number, item: Partial<Omit<SpAccount, "id">>): Promise<void> {
        await this.db.query('UPDATE sp_accounts SET ? WHERE id = ?', [item, id]);
    }

    async countByStatus(status: number): Promise<number> {
        const [result] = await this.db.query<{ count: number }[]>('SELECT COUNT(*) as count FROM sp_accounts WHERE status = ?', [status]);
        return result.count;
    }

    async updateViaToken(token: string, item: Partial<Omit<SpAccount, "constructor">>): Promise<void> {
        await this.db.query('UPDATE sp_accounts SET ? WHERE token = ?', [item, token]);
    }

    async findByStatus(status: number): Promise<SpAccount[]> {
        return this.db.query<SpAccount[]>('SELECT * FROM sp_accounts WHERE status = ?', [status]);
    }

}

import { RowDataPacket } from 'mysql2';
import { MySQLConnectionManager } from '../helpers/mysql';

export interface Permission extends RowDataPacket {
    id: number;
    ids: string;
    owner: number;
    pid: number;
    permissions: string;
    data: string;
}

export class PermissionRepository {
    private db: MySQLConnectionManager;

    constructor() {
        this.db = MySQLConnectionManager.getInstance();
    }

    // Find a permission by ID
    async findByIdOrIds(id: number | string, type: "ids" | "id" = "id"): Promise<Permission | null> {
        const [item] = await this.db.query<Permission[]>(`SELECT * FROM sp_team WHERE ${type} = ?`, [id]);
        return item || null;
    }

    // Find all permissions
    async findAll(): Promise<Permission[]> {
        return this.db.query<Permission[]>('SELECT * FROM sp_team');
    }

    // Create a new permission entry
    async create(item: Omit<Permission, 'id'>): Promise<number> {
        const result = await this.db.query<{ insertId: number }>('INSERT INTO sp_team SET ?', [item]);
        return result.insertId;
    }

    // Update a permission by ID
    async update(id: number, item: Partial<Permission>): Promise<void> {
        await this.db.query('UPDATE sp_team SET ? WHERE id = ?', [item, id]);
    }

    // Delete a permission by ID
    async delete(id: number): Promise<void> {
        await this.db.query('DELETE FROM sp_team WHERE id = ?', [id]);
    }

    // Find permissions by owner
    async findByOwner(owner: number): Promise<Permission[]> {
        return this.db.query<Permission[]>('SELECT * FROM sp_team WHERE owner = ?', [owner]);
    }

    // Find permissions by PID
    async findByPid(pid: number): Promise<Permission[]> {
        return this.db.query<Permission[]>('SELECT * FROM sp_team WHERE pid = ?', [pid]);
    }

    // Count permissions by owner
    async countByOwner(owner: number): Promise<number> {
        const [result] = await this.db.query<{ count: number }[]>('SELECT COUNT(*) as count FROM sp_team WHERE owner = ?', [owner]);
        return result.count;
    }
}

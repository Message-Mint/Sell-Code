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

}

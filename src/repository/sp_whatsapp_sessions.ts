import { MySQLConnectionManager } from '../helpers/mysql';

// Interface for the Instance table
export interface Instance {
    id: number;
    ids: string | null;
    team_id: number | null;
    instance_id: string | null;
    data: string | null;
    status: number | null;
}

export class InstanceRepository {
    private db: MySQLConnectionManager;

    constructor() {
        this.db = MySQLConnectionManager.getInstance();
    }

    // Find an instance by ID or ids
    async findByIdOrIds(id: number | string, type: "ids" | "id" = "id"): Promise<Instance | null> {
        const [item] = await this.db.query<Instance[]>(`SELECT * FROM sp_whatsapp_sessions WHERE ${type} = ?`, [id]);
        return item || null;
    }

    // Find an instance by instance_id
    async findByInstanceId(instanceId: string): Promise<Instance | null> {
        const [item] = await this.db.query<Instance[]>('SELECT * FROM sp_whatsapp_sessions WHERE instance_id = ?', [instanceId]);
        return item || null;
    }

    // Find all instances
    async findAll(): Promise<Instance[]> {
        return this.db.query<Instance[]>('SELECT * FROM sp_whatsapp_sessions');
    }

    // Create a new instance entry
    async create(item: Omit<Instance, 'id'>): Promise<number> {
        const result = await this.db.query<{ insertId: number }>('INSERT INTO sp_whatsapp_sessions SET ?', [item]);
        return result.insertId;
    }

    // Update an instance by ID
    async update(instance_id: string, item: Partial<Instance>): Promise<void> {
        const updateData: any = { ...item };

        if (item.data && typeof item.data === 'object') {
            updateData.data = JSON.stringify(item.data);
        }

        await this.db.query('UPDATE sp_whatsapp_sessions SET ? WHERE instance_id = ?', [updateData, instance_id]);
    }

    // Delete an instance by ID
    async delete(instance_id: string): Promise<void> {
        await this.db.query('DELETE FROM sp_whatsapp_sessions WHERE instance_id = ?', [instance_id]);
    }

    // Find instances by team_id
    async findByTeamId(teamId: number): Promise<Instance[]> {
        return this.db.query<Instance[]>('SELECT * FROM sp_whatsapp_sessions WHERE team_id = ?', [teamId]);
    }

    // Count instances by status
    async countByStatus(status: number): Promise<number> {
        const [result] = await this.db.query<{ count: number }[]>('SELECT COUNT(*) as count FROM sp_whatsapp_sessions WHERE status = ?', [status]);
        return result.count;
    }
}

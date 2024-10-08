import { InstanceRepository } from '../repository/sp_whatsapp_sessions';
import { PermissionRepository } from '../repository/sp_team';

export class InstanceService {
    private permissionRepo: PermissionRepository;
    private instanceRepo: InstanceRepository

    constructor() {
        this.permissionRepo = new PermissionRepository();
        this.instanceRepo = new InstanceRepository();
    }

    // Validate user based on instanceId and accessToken
    async validateUser(instanceId: string, accessToken: string): Promise<any> {
        console.log('Validating user with instanceId:', instanceId, 'and accessToken:', accessToken);

        // Find permissions based on instanceId (you can adjust this logic based on your DB structure)
        const permissions = await this.permissionRepo.findByIdOrIds(accessToken, "ids");

        // Here, you might add custom logic to validate the accessToken against the permissions
        if (!permissions) {
            throw new Error(`Access Token Is Invalid`)
        }

        const isValidInstance = await this.instanceRepo.findByInstanceId(instanceId);

        if (!isValidInstance) {
            throw new Error("Instance ID is invalid!");
        }

        return isValidInstance;
    }
}

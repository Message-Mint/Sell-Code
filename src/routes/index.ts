import { Router } from 'express';
import { helloWorld, instance } from '../controllers/controller';
import { validateQueryParams } from '../helpers/request';

const router: Router = Router();

router.get('/instance', validateQueryParams(['instance_id', 'access_token']), instance);
router.get('/get_qrcode', validateQueryParams(['instance_id', 'access_token'], { type: "qr" }), instance);
router.get('/get_paircode', validateQueryParams(['instance_id', 'access_token', 'phone'], { type: "paircode" }), instance);
router.get('/logout', validateQueryParams(['instance_id'], { type: "logout" }), instance);
router.get('/get_groups', helloWorld);
router.get('/send_message', helloWorld);
router.get('/direct_send_message', helloWorld);

export default router;

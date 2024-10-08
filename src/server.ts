import app, { startCronJobs } from './app';
import logger from './helpers/logger';

const port: number = parseInt(process.env.PORT || '3000', 10);

app.listen(port, async () => {
    await startCronJobs();
    logger.info(`Server running on port ${port}`);
});

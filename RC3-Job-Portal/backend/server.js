const app= require('./src/app');
const connectDB=require('./src/db/db');
const { port } = require('./src/config/env');

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

connectDB().catch((error) => {
    console.error('Could not connect to MongoDB; database-backed requests are unavailable:', error.message);
});
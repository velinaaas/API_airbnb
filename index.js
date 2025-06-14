const express = require('express');
const app = express();
const pool = require('./database');
// const swaggerUi = require('swagger-ui-express');
// const swaggerSpec = require('./swagger');

// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(express.json());

const authRoutes = require('./routes/authroutes');
app.use('/api/auth', authRoutes);

const userRoutes = require('./routes/userroutes');
app.use('/api/users', userRoutes);

const propertyRoutes = require('./routes/propertiesroutes');
app.use('/api/properties', propertyRoutes);

const guestRoutes = require('./routes/guestroutes');
app.use('/api/guest', guestRoutes);

const bookingRoutes = require('./routes/bookingroutes');
app.use('/api/bookings', bookingRoutes);

const hostRoutes = require('./routes/hostroutes');
app.use('/api/host', hostRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});

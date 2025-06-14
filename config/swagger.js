// swagger.js
const swaggerJSDoc = require('swagger-jsdoc');

const options = {
    definition: {
    openapi: '3.0.0',
    info: {
        title: 'Properti API',
        version: '1.0.0',
        description: 'Dokumentasi API properti dengan PostgreSQL',
    },
    servers: [
        {
        url: 'http://localhost:3000', // ganti sesuai port server kamu
        },
    ],
    },
  apis: ['./routes/*.js'], // arahkan ke file route kamu
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;

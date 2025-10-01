# Hospital Management System - Backend API

A comprehensive REST API for the Hospital Management System built with Node.js, Express.js, and MySQL.

## 🚀 Features

### Core Modules
- **Authentication & Authorization** - JWT-based with role-based access control
- **Patient Management** - Complete CRUD operations for patient records
- **Appointment Scheduling** - Manage appointments with doctors and patients
- **Treatment Records** - Track diagnoses, prescriptions, and treatments
- **Lab Test Management** - Handle lab tests and results
- **Billing System** - Invoice generation and payment tracking
- **User Management** - Admin controls for all user types
- **Dashboard Analytics** - Role-based statistics and insights

### User Roles
- **Admin** - Full system access and management
- **Doctor** - Patient care, appointments, treatments
- **Reception** - Patient registration, billing, appointments
- **Lab** - Lab test management and results

## 🛠️ Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MySQL
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer
- **Password Hashing**: bcryptjs
- **UUID Generation**: uuid

## 📋 Prerequisites

- Node.js (v16 or higher)
- MySQL (v8.0 or higher)
- npm or yarn

## 🚀 Getting Started

### 1. Installation

```bash
cd backend
npm install
```

### 2. Environment Configuration

Create a `.env` file in the backend directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=hospital_management

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# File Upload Configuration
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880
```

### 3. Database Setup

1. Create a MySQL database named `hospital_management`
2. Update the database credentials in your `.env` file
3. The API will automatically create all required tables on first run

### 4. Start the Server

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

The API will be available at `http://localhost:5000`

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication Endpoints

#### POST /api/auth/login
Login with email and password
```json
{
  "email": "admin@hospital.com",
  "password": "admin123"
}
```

#### POST /api/auth/register
Register new user (Admin only)
```json
{
  "email": "newuser@hospital.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "reception",
  "phone": "+1234567890"
}
```

#### GET /api/auth/me
Get current user profile (requires authentication)

### Patient Endpoints

#### GET /api/patients
Get all patients with pagination and search
```
Query Parameters:
- page: Page number (default: 1)
- limit: Items per page (default: 10)
- search: Search term
- gender: Filter by gender
```

#### POST /api/patients
Create new patient (Reception/Admin only)
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@email.com",
  "phone": "+1234567890",
  "dateOfBirth": "1990-01-01",
  "gender": "male",
  "address": "123 Main St, City, State",
  "emergencyContact": "Jane Doe",
  "emergencyPhone": "+1234567891",
  "medicalHistory": "No significant history",
  "allergies": "None known",
  "bloodGroup": "O+"
}
```

### Appointment Endpoints

#### GET /api/appointments
Get all appointments with filters
```
Query Parameters:
- page, limit, search, status, doctor_id, date
```

#### POST /api/appointments
Create new appointment (Reception/Admin only)
```json
{
  "patientId": "patient-uuid",
  "doctorId": "doctor-uuid",
  "dateTime": "2024-01-20T10:00:00.000Z",
  "reason": "Regular checkup",
  "notes": "Patient requested morning appointment"
}
```

### Billing Endpoints

#### GET /api/bills
Get all bills with pagination and search

#### POST /api/bills
Create new bill (Reception/Admin only)
```json
{
  "patientId": "patient-uuid",
  "doctorId": "doctor-uuid",
  "items": [
    {
      "description": "Consultation Fee",
      "quantity": 1,
      "unitPrice": 200,
      "type": "consultation"
    }
  ],
  "paymentMethod": "Credit Card",
  "notes": "Payment received"
}
```

### Lab Test Endpoints

#### GET /api/lab-tests
Get all lab tests with filters

#### POST /api/lab-tests
Create new lab test (Doctor/Admin only)
```json
{
  "patientId": "patient-uuid",
  "doctorId": "doctor-uuid",
  "testName": "Complete Blood Count",
  "testType": "Blood Test",
  "normalRanges": "Standard ranges apply"
}
```

### Dashboard Endpoints

#### GET /api/dashboard/stats
Get role-based dashboard statistics

#### GET /api/dashboard/recent-activities
Get recent activities based on user role

## 🔐 Authentication

All protected routes require a valid JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## 🛡️ Role-Based Access Control

- **Admin**: Full access to all endpoints
- **Doctor**: Access to patients, appointments, treatments, lab tests
- **Reception**: Access to patients, appointments, billing
- **Lab**: Access to lab tests and results

## 📁 File Uploads

Lab result files are uploaded to `./uploads/lab-results/` directory. Supported formats:
- Images: JPEG, PNG, GIF
- Documents: PDF, DOC, DOCX, TXT

## 🗄️ Database Schema

The API automatically creates the following tables:
- `users` - System users and authentication
- `patients` - Patient information and medical records
- `doctors` - Doctor profiles and specializations
- `appointments` - Appointment scheduling
- `treatments` - Treatment records and prescriptions
- `lab_tests` - Lab test requests and results
- `bills` - Billing and payment information
- `bill_items` - Individual bill line items

## 🔧 Development

### Project Structure
```
backend/
├── config/
│   └── database.js          # Database configuration
├── middleware/
│   └── auth.js              # Authentication middleware
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── patients.js          # Patient management
│   ├── appointments.js      # Appointment scheduling
│   ├── treatments.js        # Treatment records
│   ├── labTests.js          # Lab test management
│   ├── bills.js             # Billing system
│   ├── users.js             # User management
│   └── dashboard.js         # Dashboard analytics
├── uploads/                 # File upload directory
├── server.js                # Main server file
└── package.json
```

### Adding New Routes

1. Create route file in `routes/` directory
2. Define endpoints with proper authentication and authorization
3. Add route to `server.js`
4. Update this documentation

## 🚀 Deployment

### Production Checklist
- [ ] Set strong JWT secret
- [ ] Configure production database
- [ ] Set NODE_ENV=production
- [ ] Configure file storage (AWS S3 recommended)
- [ ] Set up SSL/HTTPS
- [ ] Configure proper CORS settings
- [ ] Set up logging and monitoring

### Environment Variables for Production
```env
NODE_ENV=production
DB_HOST=your-production-db-host
DB_USER=your-production-db-user
DB_PASSWORD=your-secure-password
JWT_SECRET=your-very-secure-jwt-secret
```

## 📝 API Testing

Use tools like Postman or curl to test the API endpoints:

```bash
# Health check
curl http://localhost:5000/api/health

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hospital.com","password":"admin123"}'
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the API health endpoint: `GET /api/health`
- Review the error logs for debugging

---

**Note**: This is a production-ready backend API. Make sure to configure proper security settings and database credentials before deploying to production.

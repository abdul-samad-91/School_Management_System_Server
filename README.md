# School Management System - Backend API

Backend API for the School Management System built with Node.js, Express.js, and MongoDB.

## Features

- 🔐 Authentication & Authorization (JWT-based)
- 👥 User Management (Super Admin & Admin roles)
- 🏫 School Profile Management
- 📚 Academic Session Management
- 🎓 Class, Section & Subject Management
- 👨‍🎓 Student Management
- 👨‍🏫 Teacher & Staff Management
- 📝 Attendance Tracking
- 📊 Exam & Result Management
- 💰 Fee Structure & Payment Management
- 📢 Communication System (Announcements)
- 📈 Dashboard with Analytics
- 🎨 Timetable Management
- 📜 Certificate Generation

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose ODM
- **Authentication:** JWT (JSON Web Tokens)
- **Security:** Helmet, CORS, bcryptjs
- **Validation:** express-validator

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (v5 or higher)
- npm or yarn

## Installation

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the backend directory:
```bash
cp .env.example .env
```

4. Update the `.env` file with your configuration:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/school_management
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=30d
CLIENT_URL=http://localhost:5173
```

5. Seed the database with initial data:
```bash
npm run seed
```

This will create:
- Super Admin user (username: `superadmin`, password: `Admin@123`)
- Default academic session
- Default grading system

## Running the Server

### Development mode:
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user (Super Admin only)
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/update-password` - Update password
- `POST /api/auth/logout` - Logout user

### School
- `GET /api/school/profile` - Get school profile
- `POST /api/school/profile` - Create school profile
- `PUT /api/school/profile/:id` - Update school profile

### Academic
- `GET /api/academic/sessions` - Get all sessions
- `POST /api/academic/sessions` - Create session
- `PUT /api/academic/sessions/:id` - Update session
- `PUT /api/academic/sessions/:id/activate` - Set active session
- `GET /api/academic/classes` - Get all classes
- `POST /api/academic/classes` - Create class
- `GET /api/academic/subjects` - Get all subjects
- `POST /api/academic/subjects` - Create subject
- `GET /api/academic/timetables` - Get timetables
- `POST /api/academic/timetables` - Create timetable

### Students
- `GET /api/students` - Get all students
- `GET /api/students/:id` - Get single student
- `POST /api/students` - Create student
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student
- `PUT /api/students/:id/status` - Update student status
- `PUT /api/students/:id/approve` - Approve admission
- `POST /api/students/promote` - Promote students

### Teachers
- `GET /api/teachers` - Get all teachers
- `GET /api/teachers/:id` - Get single teacher
- `POST /api/teachers` - Create teacher
- `PUT /api/teachers/:id` - Update teacher
- `DELETE /api/teachers/:id` - Delete teacher
- `PUT /api/teachers/:id/assign-subjects` - Assign subjects
- `PUT /api/teachers/:id/assign-classes` - Assign classes

### Attendance
- `POST /api/attendance` - Mark attendance
- `GET /api/attendance` - Get attendance records
- `PUT /api/attendance/:id` - Update attendance
- `GET /api/attendance/report` - Get attendance report

### Exams & Results
- `GET /api/exams` - Get all exams
- `POST /api/exams` - Create exam
- `GET /api/exams/results/all` - Get all results
- `POST /api/exams/results` - Create result
- `POST /api/exams/results/publish` - Publish results

### Fees
- `GET /api/fees/structures` - Get fee structures
- `POST /api/fees/structures` - Create fee structure
- `GET /api/fees/payments` - Get payments
- `POST /api/fees/payments` - Record payment
- `GET /api/fees/payments/summary/student` - Get payment summary

### Communication
- `GET /api/communication/announcements` - Get announcements
- `POST /api/communication/announcements` - Create announcement
- `PUT /api/communication/announcements/:id/read` - Mark as read

### Users (Super Admin only)
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get single user
- `PUT /api/users/:id` - Update user
- `PUT /api/users/:id/permissions` - Update user permissions
- `PUT /api/users/:id/toggle-status` - Toggle user status
- `DELETE /api/users/:id` - Delete user

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/attendance-chart` - Get attendance chart data
- `GET /api/dashboard/fee-chart` - Get fee collection chart data

## Permission System

The system uses a role-based permission system:

### Roles
- **Super Admin:** Full system access
- **Admin:** Limited access based on assigned permissions

### Modules & Actions
Modules: `school_setup`, `students`, `teachers`, `academics`, `fees`, `communication`, `reports`, `users`

Actions: `view`, `create`, `update`, `delete`, `export`

## Security Features

- Password hashing with bcryptjs
- JWT-based authentication
- Role-based access control
- Permission-based authorization
- Request validation
- CORS protection
- Helmet security headers
- Rate limiting (recommended for production)

## Error Handling

The API uses standardized error responses:

```json
{
  "success": false,
  "message": "Error message here"
}
```

Success responses:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

## Default Credentials

After seeding:
- **Username:** superadmin
- **Password:** Admin@123

⚠️ **Important:** Change the default password immediately after first login!

## Production Deployment

1. Set `NODE_ENV=production` in your .env file
2. Use a strong JWT_SECRET
3. Enable rate limiting
4. Use HTTPS
5. Configure proper CORS settings
6. Set up MongoDB replica set for production
7. Implement automated backups
8. Use environment-specific configuration

## Support

For issues and questions, please refer to the main project documentation.


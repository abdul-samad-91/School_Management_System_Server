import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.model.js';
import AcademicSession from '../models/AcademicSession.model.js';
import School from '../models/School.model.js';
import GradingSystem from '../models/GradingSystem.model.js';

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');

    // Clear existing data (optional - comment out if you want to preserve existing data)
    // await User.deleteMany({});
    // await AcademicSession.deleteMany({});
    // await School.deleteMany({});

    // Create Super Admin
    const superAdminExists = await User.findOne({ role: 'super_admin' });
    
    if (!superAdminExists) {
      await User.create({
        username: 'superadmin',
        email: 'admin@school.com',
        password: 'Admin@123',
        role: 'super_admin',
        profile: {
          firstName: 'Super',
          lastName: 'Admin',
          phone: '1234567890'
        },
        isActive: true
      });
      console.log('✅ Super Admin created');
      console.log('   Username: superadmin');
      console.log('   Password: Admin@123');
      console.log('   ⚠️  Please change the default password after first login!');
    } else {
      console.log('ℹ️  Super Admin already exists');
    }

    // Create default academic session
    const sessionExists = await AcademicSession.findOne();
    
    if (!sessionExists) {
      const currentYear = new Date().getFullYear();
      await AcademicSession.create({
        name: `${currentYear}-${currentYear + 1}`,
        startDate: new Date(`${currentYear}-04-01`),
        endDate: new Date(`${currentYear + 1}-03-31`),
        isActive: true,
        isLocked: false,
        description: 'Default academic session'
      });
      console.log('✅ Default academic session created');
    } else {
      console.log('ℹ️  Academic session already exists');
    }

    // Create default grading system
    const gradingSystemExists = await GradingSystem.findOne();
    
    if (!gradingSystemExists) {
      await GradingSystem.create({
        name: 'Standard Grading System',
        type: 'letter',
        grades: [
          { name: 'A+', minPercentage: 90, maxPercentage: 100, gradePoint: 10, description: 'Outstanding' },
          { name: 'A', minPercentage: 80, maxPercentage: 89, gradePoint: 9, description: 'Excellent' },
          { name: 'B+', minPercentage: 70, maxPercentage: 79, gradePoint: 8, description: 'Very Good' },
          { name: 'B', minPercentage: 60, maxPercentage: 69, gradePoint: 7, description: 'Good' },
          { name: 'C+', minPercentage: 50, maxPercentage: 59, gradePoint: 6, description: 'Above Average' },
          { name: 'C', minPercentage: 40, maxPercentage: 49, gradePoint: 5, description: 'Average' },
          { name: 'D', minPercentage: 33, maxPercentage: 39, gradePoint: 4, description: 'Pass' },
          { name: 'F', minPercentage: 0, maxPercentage: 32, gradePoint: 0, description: 'Fail' }
        ],
        passingGrade: 'D',
        isDefault: true,
        isActive: true
      });
      console.log('✅ Default grading system created');
    } else {
      console.log('ℹ️  Grading system already exists');
    }

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Start the server: npm run dev');
    console.log('   2. Login with super admin credentials');
    console.log('   3. Create school profile');
    console.log('   4. Add admin users, teachers, and students\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();


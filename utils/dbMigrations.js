import mongoose from 'mongoose';

/**
 * Drop conflicting database indexes that may exist from previous schema versions
 */
export const cleanupOldIndexes = async () => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      console.log('ℹ️ Database connection not ready, skipping index cleanup');
      return;
    }

    // Drop the old unique index on (name, session) from Class model
    try {
      await db.collection('classes').dropIndex('name_1_session_1');
      console.log('✅ Dropped old index: name_1_session_1 from classes');
    } catch (err) {
      if (err.message.includes('index not found')) {
        console.log('ℹ️ Old index name_1_session_1 not found (already dropped)');
      } else {
        throw err;
      }
    }

    // Drop combined index if it exists
    try {
      await db.collection('classes').dropIndex('school_1_name_1_session_1');
      console.log('✅ Dropped old index: school_1_name_1_session_1 from classes');
    } catch (err) {
      if (!err.message.includes('index not found')) {
        throw err;
      }
    }

    // Drop old Timetable indexes
    try {
      await db.collection('timetables').dropIndex('school_1_session_1_class_1_section_1_isActive_1');
      console.log('✅ Dropped old index: school_1_session_1_class_1_section_1_isActive_1 from timetables');
    } catch (err) {
      if (!err.message.includes('index not found')) {
        // Index may have been dropped or not exist, continue
        if (!err.message.includes('index not found')) {
          console.log('ℹ️ Old Timetable index not found (already dropped or never existed)');
        }
      }
    }
  } catch (error) {
    console.error('⚠️ Error during database cleanup:', error.message);
  }
};

/**
 * Generate unique numbers for admission, receipt, certificate, etc.
 */

import Counter from '../models/Counter.model.js';

export const generateAdmissionNumber = (year) => {
  const timestamp = Date.now().toString().slice(-6);
  return `ADM${year}${timestamp}`;
};

export const generateReceiptNumber = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `REC${timestamp}${random}`;
};

export const generateCertificateNumber = (type, year) => {
  const timestamp = Date.now().toString().slice(-6);
  const typeCode = type.substring(0, 3).toUpperCase();
  return `CERT${typeCode}${year}${timestamp}`;
};

export const generateEmployeeId = async (year = new Date().getFullYear()) => {
  const counter = await Counter.findOneAndUpdate(
    { name: `teacher_employeeId_${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const sequence = String(counter.seq).padStart(5, '0');
  return `EMP${year}${sequence}`;
};

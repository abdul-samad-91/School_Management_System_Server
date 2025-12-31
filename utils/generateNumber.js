/**
 * Generate unique numbers for admission, receipt, certificate, etc.
 */

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

export const generateEmployeeId = (year) => {
  const timestamp = Date.now().toString().slice(-5);
  return `EMP${year}${timestamp}`;
};


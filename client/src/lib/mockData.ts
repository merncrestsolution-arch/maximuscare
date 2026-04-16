import { User, Patient, Visit, AttendanceRecord } from './types';

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Hajara Inshaf', email: 'admin@maximus.com', role: 'Admin', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Hajara', branch: 'Colombo', address: 'Colombo 05', nic: 'NIC-123456789V', passportNo: 'N/A', phone: '+94 77 000 0001', degree: 'BSc Health Administration' },
  { id: 'u2', name: 'Dr. Inshaf (PT)', email: 'md@maximus.com', role: 'MD', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Inshaf', branch: 'Colombo', address: 'Dehiwala', nic: 'NIC-987654321V', passportNo: 'N/A', phone: '+94 77 000 0002', degree: 'BSc Physiotherapy, MPT' },
  { id: 'u3', name: 'Naweedh Ahamed', email: 'reception@maximus.com', role: 'Receptionist', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Naweedh', branch: 'Colombo', address: 'Wellawatte', nic: 'NIC-456789123V', passportNo: 'N/A', phone: '+94 77 000 0003', degree: 'Diploma in Medical Administration' },
  { id: 'u4', name: 'Dr. Ihsan (PT)', email: 'ihsan@maximus.com', role: 'Physiotherapist', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ihsan', branch: 'Colombo', address: 'Mount Lavinia', nic: 'NIC-852147963V', passportNo: 'N/A', phone: '+94 77 000 0004', degree: 'BSc Physiotherapy' },
  { id: 'u5', name: 'Dr. Rihama (PT)', email: 'rihama@maximus.com', role: 'Physiotherapist', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rihama', branch: 'Colombo', address: 'Colombo 04', nic: 'NIC-789456123V', passportNo: 'N/A', phone: '+94 77 000 0005', degree: 'BSc Physiotherapy' },
  { id: 'u6', name: 'Dr. Sumaiya (PT)', email: 'sumaiya@maximus.com', role: 'Physiotherapist', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sumaiya', branch: 'Bandaragama', address: 'Bandaragama', nic: 'NIC-321654987V', passportNo: 'N/A', phone: '+94 77 000 0006', degree: 'BSc Physiotherapy' },
  { id: 'u7', name: 'Praveen (PT)', email: 'praveen@maximus.com', role: 'Physiotherapist', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Praveen', branch: 'Bandaragama', address: 'Panadura', nic: 'NIC-147852369V', passportNo: 'N/A', phone: '+94 77 000 0007', degree: 'BSc Physiotherapy' },
];

export const MOCK_PATIENTS: Patient[] = [
  { id: 'p1', name: 'John Doe', phone: '0771234567', age: 45, gender: 'Male', address: 'Colombo 03', registeredDate: '2023-10-15', branch: 'Colombo', status: 'Active', defaultVisitType: 'Clinic', condition: 'Lower Back Pain' },
  { id: 'p2', name: 'Jane Smith', phone: '0719876543', age: 32, gender: 'Female', address: 'Nugegoda', registeredDate: '2023-11-02', branch: 'Colombo', status: 'Active', defaultVisitType: 'Clinic', condition: 'Neck Pain' },
  { id: 'p3', name: 'Kamal Perera', phone: '0755555555', age: 60, gender: 'Male', address: 'Bandaragama', registeredDate: '2023-12-01', branch: 'Bandaragama', status: 'Active', defaultVisitType: 'Home', condition: 'Knee Osteoarthritis' },
];

export const MOCK_VISITS: Visit[] = [
  {
    id: 'v1',
    patientId: 'p1',
    sessionNumber: 1,
    condition: 'Lower Back Pain',
    treatment: 'Manual Therapy + TENS',
    visitDate: '2023-10-15',
    startTime: '10:00',
    endTime: '11:00',
    branch: 'Colombo',
    visitType: 'Clinic',
    status: 'Follow-up',
    paymentAmount: 2500,
    paymentStatus: 'Paid',
    paymentMode: 'Cash',
    createdByStaffId: 'u4',
    createdByName: 'Dr. Ihsan (PT)',
    treatingStaffId: 'u4',
    treatingStaffName: 'Dr. Ihsan (PT)',
    createdAt: '2023-10-15T10:00:00Z',
    updatedAt: '2023-10-15T10:00:00Z'
  },
  {
    id: 'v2',
    patientId: 'p2',
    sessionNumber: 1,
    condition: 'Frozen Shoulder',
    treatment: 'Mobilization',
    visitDate: '2023-11-02',
    startTime: '14:00',
    endTime: '15:00',
    branch: 'Colombo',
    visitType: 'Clinic',
    status: 'Follow-up',
    paymentAmount: 3000,
    paymentStatus: 'Unpaid',
    paymentMode: 'Cash',
    createdByStaffId: 'u5',
    createdByName: 'Dr. Rihama (PT)',
    treatingStaffId: 'u5',
    treatingStaffName: 'Dr. Rihama (PT)',
    createdAt: '2023-11-02T14:00:00Z',
    updatedAt: '2023-11-02T14:00:00Z'
  }
];

export const MOCK_ATTENDANCE: AttendanceRecord[] = [
  // Past records for demo
  { id: 'a1', staffId: 'u4', staffName: 'Dr. Ihsan (PT)', role: 'Physiotherapist', date: '2023-10-25', status: 'Present', checkInTime: '2023-10-25T08:30:00Z', checkOutTime: '2023-10-25T17:00:00Z' },
  { id: 'a2', staffId: 'u4', staffName: 'Dr. Ihsan (PT)', role: 'Physiotherapist', date: '2023-10-26', status: 'Present', checkInTime: '2023-10-26T09:00:00Z', checkOutTime: '2023-10-26T16:30:00Z' },
];

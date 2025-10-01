// Bill Repository (DB access for bills)
const { v4: uuidv4 } = require("uuid");
const Bill = require("../models/Bill");
const Patient = require("../models/Patient");
const Doctor = require("../models/Doctor");
const User = require("../models/User");

const billRepository = {
  async getAll({ page = 1, limit = 10, search = "", status = "" }) {
    const filter = {};
    if (status) {
      filter.status = status;
    }
    // For search, we need to search in bill _id, patient first/last name, patient email
    let patientIds = [];
    if (search) {
      // Find matching patients
      const patientFilter = {
        $or: [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      };
      const patients = await Patient.find(patientFilter).select("_id");
      patientIds = patients.map((p) => p._id);
      filter.$or = [
        { _id: { $regex: search, $options: "i" } },
        { patientId: { $in: patientIds } },
      ];
    }
    const skip = (page - 1) * limit;
    const [bills, total] = await Promise.all([
      Bill.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: "patientId",
          select: "firstName lastName email phone",
        })
        .populate({
          path: "doctorId",
          select: "specialization userId",
          populate: {
            path: "userId",
            select: "first_name last_name",
            model: "User",
          },
        }),
      Bill.countDocuments(filter),
    ]);
    const totalPages = Math.ceil(total / limit);
    // Format bills to match old SQL output
    const formattedBills = bills.map((bill) => {
      const patient = bill.patientId;
      const doctor = bill.doctorId;
      const doctorUser = doctor && doctor.userId ? doctor.userId : null;
      return {
        id: bill._id,
        patient_id: patient ? patient._id : null,
        doctor_id: doctor ? doctor._id : null,
        total_amount: bill.totalAmount,
        paid_amount: bill.paidAmount,
        status: bill.status,
        payment_method: bill.paymentMethod,
        notes: bill.notes,
        created_at: bill.createdAt,
        patient_first_name: patient ? patient.firstName : null,
        patient_last_name: patient ? patient.lastName : null,
        patient_email: patient ? patient.email : null,
        patient_phone: patient ? patient.phone : null,
        specialization: doctor ? doctor.specialization : null,
        doctor_first_name: doctorUser ? doctorUser.first_name : null,
        doctor_last_name: doctorUser ? doctorUser.last_name : null,
        items: bill.items || [],
      };
    });
    return {
      bills: formattedBills,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  },

  async getById(id) {
    const bill = await Bill.findById(id)
      .populate({
        path: "patientId",
        select: "firstName lastName email phone address",
      })
      .populate({
        path: "doctorId",
        select: "specialization userId",
        populate: {
          path: "userId",
          select: "first_name last_name",
          model: "User",
        },
      });
    if (!bill) return null;
    const patient = bill.patientId;
    const doctor = bill.doctorId;
    const doctorUser = doctor && doctor.userId ? doctor.userId : null;
    return {
      id: bill._id,
      patient_id: patient ? patient._id : null,
      doctor_id: doctor ? doctor._id : null,
      total_amount: bill.totalAmount,
      paid_amount: bill.paidAmount,
      status: bill.status,
      payment_method: bill.paymentMethod,
      notes: bill.notes,
      created_at: bill.createdAt,
      patient_first_name: patient ? patient.firstName : null,
      patient_last_name: patient ? patient.lastName : null,
      patient_email: patient ? patient.email : null,
      patient_phone: patient ? patient.phone : null,
      patient_address: patient ? patient.address : null,
      specialization: doctor ? doctor.specialization : null,
      doctor_first_name: doctorUser ? doctorUser.first_name : null,
      doctor_last_name: doctorUser ? doctorUser.last_name : null,
      items: bill.items || [],
    };
  },

  async create({ patientId, doctorId, items, paymentMethod, notes }) {
    let totalAmount = 0;
    for (const item of items) {
      item.totalPrice = item.quantity * item.unitPrice;
      totalAmount += item.totalPrice;
    }
    const billId = uuidv4();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO bills (id, patient_id, doctor_id, total_amount, paid_amount, status, payment_method, notes) VALUES ($1, $2, $3, $4, 0, $5, $6, $7)",
        [
          billId,
          patientId,
          doctorId,
          totalAmount,
          "pending",
          paymentMethod || null,
          notes || null,
        ]
      );
      for (const item of items) {
        const itemId = uuidv4();
        await client.query(
          "INSERT INTO bill_items (id, bill_id, description, quantity, unit_price, total_price, type) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [
            itemId,
            billId,
            item.description,
            item.quantity,
            item.unitPrice,
            item.totalPrice,
            item.type || "other",
          ]
        );
      }
      await client.query("COMMIT");
      // Get the created bill with items
      const { rows: newBills } = await pool.query(
        `SELECT b.*, p.first_name as patient_first_name, p.last_name as patient_last_name FROM bills b JOIN patients p ON b.patient_id = p.id WHERE b.id = $1`,
        [billId]
      );
      const { rows: billItems } = await pool.query(
        "SELECT * FROM bill_items WHERE bill_id = $1",
        [billId]
      );
      newBills[0].items = billItems;
      return newBills[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async updatePayment(id, paidAmount, paymentMethod) {
    const { rows: bills } = await pool.query(
      "SELECT total_amount, paid_amount FROM bills WHERE id = $1",
      [id]
    );
    if (bills.length === 0) return null;
    const bill = bills[0];
    const newPaidAmount = parseFloat(paidAmount);
    const totalAmount = parseFloat(bill.total_amount);
    if (newPaidAmount > totalAmount)
      throw new Error("Paid amount cannot exceed total amount");
    let newStatus = "pending";
    if (newPaidAmount >= totalAmount) newStatus = "paid";
    else if (newPaidAmount > 0) newStatus = "partial";
    await pool.query(
      "UPDATE bills SET paid_amount = $1, status = $2, payment_method = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4",
      [newPaidAmount, newStatus, paymentMethod, id]
    );
    return { newPaidAmount, newStatus, balance: totalAmount - newPaidAmount };
  },

  async updateStatus(id, status) {
    const validStatuses = ["pending", "partial", "paid", "cancelled"];
    if (!validStatuses.includes(status)) throw new Error("Invalid status");
    const { rows: bills } = await pool.query(
      "SELECT id FROM bills WHERE id = $1",
      [id]
    );
    if (bills.length === 0) return null;
    await pool.query(
      "UPDATE bills SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [status, id]
    );
    return true;
  },

  async remove(id) {
    const { rows: bills } = await pool.query(
      "SELECT id FROM bills WHERE id = $1",
      [id]
    );
    if (bills.length === 0) return null;
    await pool.query("DELETE FROM bills WHERE id = $1", [id]);
    return true;
  },

  async getStatsOverview() {
    const { rows: statsRows } = await pool.query(`
      SELECT 
        COUNT(*) as total_bills,
        SUM(total_amount) as total_amount,
        SUM(paid_amount) as total_paid,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_bills,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_bills,
        SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial_bills,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_bills
      FROM bills
    `);
    const { rows: monthlyStats } = await pool.query(`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COUNT(*) as bills_count,
        SUM(total_amount) as total_amount,
        SUM(paid_amount) as paid_amount
      FROM bills 
      WHERE created_at >= (CURRENT_DATE - INTERVAL '12 months')
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month DESC
    `);
    return {
      overview: statsRows[0],
      monthlyStats,
    };
  },
};

module.exports = billRepository;

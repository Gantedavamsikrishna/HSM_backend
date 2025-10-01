// Bill Repository (DB access for bills)
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../config/database");

const billRepository = {
  async getAll({ page = 1, limit = 10, search = "", status = "" }) {
    const offset = (page - 1) * limit;
    let query = `
      SELECT b.id, b.patient_id, b.doctor_id, b.total_amount, b.paid_amount, 
             b.status, b.payment_method, b.notes, b.created_at,
             p.first_name as patient_first_name, p.last_name as patient_last_name,
             p.email as patient_email, p.phone as patient_phone,
             d.specialization, u.first_name as doctor_first_name, u.last_name as doctor_last_name
      FROM bills b
      JOIN patients p ON b.patient_id = p.id
      LEFT JOIN doctors d ON b.doctor_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      WHERE 1=1
    `;
    let params = [];
    let paramIdx = 1;
    if (search) {
      query += ` AND (b.id ILIKE $${paramIdx} OR p.first_name ILIKE $${
        paramIdx + 1
      } OR p.last_name ILIKE $${paramIdx + 2} OR p.email ILIKE $${
        paramIdx + 3
      })`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      paramIdx += 4;
    }
    if (status) {
      query += ` AND b.status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }
    query += ` ORDER BY b.created_at DESC LIMIT $${paramIdx} OFFSET $${
      paramIdx + 1
    }`;
    params.push(limit, offset);
    const { rows: bills } = await pool.query(query, params);
    for (let bill of bills) {
      const { rows: items } = await pool.query(
        "SELECT * FROM bill_items WHERE bill_id = $1",
        [bill.id]
      );
      bill.items = items;
    }
    // Count query
    let countQuery = `SELECT COUNT(*) as total FROM bills b JOIN patients p ON b.patient_id = p.id WHERE 1=1`;
    let countParams = [];
    let countIdx = 1;
    if (search) {
      countQuery += ` AND (b.id ILIKE $${countIdx} OR p.first_name ILIKE $${
        countIdx + 1
      } OR p.last_name ILIKE $${countIdx + 2} OR p.email ILIKE $${
        countIdx + 3
      })`;
      const searchPattern = `%${search}%`;
      countParams.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      );
      countIdx += 4;
    }
    if (status) {
      countQuery += ` AND b.status = $${countIdx}`;
      countParams.push(status);
      countIdx++;
    }
    const { rows: countResult } = await pool.query(countQuery, countParams);
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);
    return {
      bills,
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
    const { rows: bills } = await pool.query(
      `SELECT b.*, p.first_name as patient_first_name, p.last_name as patient_last_name,
              p.email as patient_email, p.phone as patient_phone, p.address as patient_address,
              d.specialization, u.first_name as doctor_first_name, u.last_name as doctor_last_name
       FROM bills b
       JOIN patients p ON b.patient_id = p.id
       LEFT JOIN doctors d ON b.doctor_id = d.id
       LEFT JOIN users u ON d.user_id = u.id
       WHERE b.id = $1`,
      [id]
    );
    if (bills.length === 0) return null;
    const bill = bills[0];
    const { rows: items } = await pool.query(
      "SELECT * FROM bill_items WHERE bill_id = $1",
      [id]
    );
    bill.items = items;
    return bill;
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

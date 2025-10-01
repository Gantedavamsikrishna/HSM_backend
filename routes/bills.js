const express = require("express");
const { v4: uuidv4 } = require("uuid");
const Bill = require("../models/Bill");
const Patient = require("../models/Patient");
const Doctor = require("../models/Doctor");
const { authenticateToken, requireRole } = require("../middleware/auth");
const billsController = require("../controllers/billsController");

const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const status = req.query.status || "";
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

    if (search) {
      query += ` AND (b.id LIKE ? OR p.first_name LIKE ? OR p.last_name LIKE ? OR p.email LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (status) {
      query += ` AND b.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY b.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const [bills] = await pool.execute(query, params);

    for (let bill of bills) {
      const [items] = await pool.execute(
        "SELECT * FROM bill_items WHERE bill_id = ?",
        [bill.id]
      );
      bill.items = items;
    }

    let countQuery = `
      SELECT COUNT(*) as total FROM bills b
      JOIN patients p ON b.patient_id = p.id
      WHERE 1=1
    `;
    let countParams = [];

    if (search) {
      countQuery += ` AND (b.id LIKE ? OR p.first_name LIKE ? OR p.last_name LIKE ? OR p.email LIKE ?)`;
      const searchPattern = `%${search}%`;
      countParams.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      );
    }

    if (status) {
      countQuery += ` AND b.status = ?`;
      countParams.push(status);
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      bills,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Get bills error:", error);
    res.status(500).json({ message: "Failed to fetch bills" });
  }
});
router.get("/", authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const status = req.query.status || "";
    const skip = (page - 1) * limit;

    let query = {};
    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { _id: search.match(/^[a-f\d]{24}$/i) ? search : undefined },
        { notes: regex },
      ];
      // Remove undefined if _id is not a valid ObjectId
      query.$or = query.$or.filter(Boolean);
    }
    if (status) {
      query.status = status;
    }

    const bills = await Bill.find(query)
      .populate({
        path: "patientId",
        select: "first_name last_name email phone",
      })
      .populate({ path: "doctorId", select: "specialization" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Bill.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    res.json({
      bills,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Get bills error:", error);
    res.status(500).json({ message: "Failed to fetch bills" });
  }
});
router.get("/", authenticateToken, billsController.getAll);

router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [bills] = await pool.execute(
      `SELECT b.*, p.first_name as patient_first_name, p.last_name as patient_last_name,
              p.email as patient_email, p.phone as patient_phone, p.address as patient_address,
              d.specialization, u.first_name as doctor_first_name, u.last_name as doctor_last_name
       FROM bills b
       JOIN patients p ON b.patient_id = p.id
       LEFT JOIN doctors d ON b.doctor_id = d.id
       LEFT JOIN users u ON d.user_id = u.id
       WHERE b.id = ?`,
      [id]
    );

    if (bills.length === 0) {
      return res.status(404).json({ message: "Bill not found" });
    }

    const bill = bills[0];

    const [items] = await pool.execute(
      "SELECT * FROM bill_items WHERE bill_id = ?",
      [id]
    );

    bill.items = items;

    res.json({ bill });
  } catch (error) {
    console.error("Get bill error:", error);
    res.status(500).json({ message: "Failed to fetch bill" });
  }
});
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const bill = await Bill.findById(id)
      .populate({
        path: "patientId",
        select: "first_name last_name email phone address",
      })
      .populate({ path: "doctorId", select: "specialization" })
      .lean();
    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }
    res.json({ bill });
  } catch (error) {
    console.error("Get bill by id error:", error);
    res.status(500).json({ message: "Failed to fetch bill" });
  }
});
router.get("/:id", authenticateToken, billsController.getById);

router.post(
  "/",
  authenticateToken,
  requireRole(["admin", "reception"]),
  async (req, res) => {
    try {
      const { patientId, doctorId, items, paymentMethod, notes } = req.body;

      if (!patientId || !items || !Array.isArray(items) || items.length === 0) {
        return res
          .status(400)
          .json({ message: "Patient ID and items are required" });
      }

      // Validate patient exists
      const [patients] = await pool.execute(
        "SELECT id FROM patients WHERE id = ?",
        [patientId]
      );

      if (patients.length === 0) {
        return res.status(404).json({ message: "Patient not found" });
      }

      // Validate doctor exists if provided
      if (doctorId) {
        const [doctors] = await pool.execute(
          "SELECT id FROM doctors WHERE id = ?",
          [doctorId]
        );

        if (doctors.length === 0) {
          return res.status(404).json({ message: "Doctor not found" });
        }
      }

      // Calculate total amount
      let totalAmount = 0;
      for (const item of items) {
        if (!item.description || !item.quantity || !item.unitPrice) {
          return res.status(400).json({
            message:
              "Each item must have description, quantity, and unit price",
          });
        }
        item.totalPrice = item.quantity * item.unitPrice;
        totalAmount += item.totalPrice;
      }

      const billId = uuidv4();

      // Start transaction
      const connection = await pool.getConnection();
      await connection.beginTransaction();

      try {
        // Create bill
        await connection.execute(
          "INSERT INTO bills (id, patient_id, doctor_id, total_amount, paid_amount, status, payment_method, notes) VALUES (?, ?, ?, ?, 0, ?, ?, ?)",
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

        // Create bill items
        for (const item of items) {
          const itemId = uuidv4();
          await connection.execute(
            "INSERT INTO bill_items (id, bill_id, description, quantity, unit_price, total_price, type) VALUES (?, ?, ?, ?, ?, ?, ?)",
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

        await connection.commit();

        // Get the created bill with items
        const [newBills] = await connection.execute(
          `SELECT b.*, p.first_name as patient_first_name, p.last_name as patient_last_name
         FROM bills b
         JOIN patients p ON b.patient_id = p.id
         WHERE b.id = ?`,
          [billId]
        );

        const [billItems] = await connection.execute(
          "SELECT * FROM bill_items WHERE bill_id = ?",
          [billId]
        );

        newBills[0].items = billItems;

        res.status(201).json({
          message: "Bill created successfully",
          bill: newBills[0],
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("Create bill error:", error);
      res.status(500).json({ message: "Failed to create bill" });
    }
  }
);
router.post(
  "/",
  authenticateToken,
  requireRole(["admin", "reception"]),
  billsController.create
);

// Update bill payment (Reception and Admin only)
router.put(
  "/:id/payment",
  authenticateToken,
  requireRole(["admin", "reception"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { paidAmount, paymentMethod } = req.body;

      if (!paidAmount || paidAmount < 0) {
        return res
          .status(400)
          .json({ message: "Valid paid amount is required" });
      }

      // Get current bill
      const [bills] = await pool.execute(
        "SELECT total_amount, paid_amount FROM bills WHERE id = ?",
        [id]
      );

      if (bills.length === 0) {
        return res.status(404).json({ message: "Bill not found" });
      }

      const bill = bills[0];
      const newPaidAmount = parseFloat(paidAmount);
      const totalAmount = parseFloat(bill.total_amount);
      const currentPaidAmount = parseFloat(bill.paid_amount);

      if (newPaidAmount > totalAmount) {
        return res
          .status(400)
          .json({ message: "Paid amount cannot exceed total amount" });
      }

      // Determine new status
      let newStatus = "pending";
      if (newPaidAmount >= totalAmount) {
        newStatus = "paid";
      } else if (newPaidAmount > 0) {
        newStatus = "partial";
      }

      // Update bill
      await pool.execute(
        "UPDATE bills SET paid_amount = ?, status = ?, payment_method = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [newPaidAmount, newStatus, paymentMethod, id]
      );

      res.json({
        message: "Payment updated successfully",
        newPaidAmount,
        newStatus,
        balance: totalAmount - newPaidAmount,
      });
    } catch (error) {
      console.error("Update payment error:", error);
      res.status(500).json({ message: "Failed to update payment" });
    }
  }
);
router.put(
  "/:id/payment",
  authenticateToken,
  requireRole(["admin", "reception"]),
  billsController.updatePayment
);

// Update bill status (Admin only)
router.put(
  "/:id/status",
  authenticateToken,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ["pending", "partial", "paid", "cancelled"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      // Check if bill exists
      const [bills] = await pool.execute("SELECT id FROM bills WHERE id = ?", [
        id,
      ]);

      if (bills.length === 0) {
        return res.status(404).json({ message: "Bill not found" });
      }

      await pool.execute(
        "UPDATE bills SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [status, id]
      );

      res.json({ message: "Bill status updated successfully" });
    } catch (error) {
      console.error("Update bill status error:", error);
      res.status(500).json({ message: "Failed to update bill status" });
    }
  }
);
router.put(
  "/:id/status",
  authenticateToken,
  requireRole(["admin"]),
  billsController.updateStatus
);

// Delete bill (Admin only)
router.delete(
  "/:id",
  authenticateToken,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Check if bill exists
      const [bills] = await pool.execute("SELECT id FROM bills WHERE id = ?", [
        id,
      ]);

      if (bills.length === 0) {
        return res.status(404).json({ message: "Bill not found" });
      }

      // Delete bill (cascade will handle bill items)
      await pool.execute("DELETE FROM bills WHERE id = ?", [id]);

      res.json({ message: "Bill deleted successfully" });
    } catch (error) {
      console.error("Delete bill error:", error);
      res.status(500).json({ message: "Failed to delete bill" });
    }
  }
);
router.delete(
  "/:id",
  authenticateToken,
  requireRole(["admin"]),
  billsController.remove
);

// Get billing statistics
router.get("/stats/overview", authenticateToken, async (req, res) => {
  try {
    const [stats] = await pool.execute(`
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

    const [monthlyStats] = await pool.execute(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as bills_count,
        SUM(total_amount) as total_amount,
        SUM(paid_amount) as paid_amount
      FROM bills 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month DESC
    `);

    res.json({
      overview: stats[0],
      monthlyStats,
    });
  } catch (error) {
    console.error("Get billing stats error:", error);
    res.status(500).json({ message: "Failed to fetch billing statistics" });
  }
});
router.get("/stats/overview", authenticateToken, billsController.statsOverview);

module.exports = router;

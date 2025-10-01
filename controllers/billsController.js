// Bill Controller (handles HTTP requests)
const billService = require("../services/billsService");

const billsController = {
  async getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || "";
      const status = req.query.status || "";
      const result = await billService.getAllBills({
        page,
        limit,
        search,
        status,
      });
      res.json(result);
    } catch (error) {
      console.error("Get bills error:", error);
      res.status(500).json({ message: "Failed to fetch bills" });
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params;
      const bill = await billService.getBillById(id);
      if (!bill) return res.status(404).json({ message: "Bill not found" });
      res.json({ bill });
    } catch (error) {
      console.error("Get bill error:", error);
      res.status(500).json({ message: "Failed to fetch bill" });
    }
  },

  async create(req, res) {
    try {
      const { patientId, doctorId, items, paymentMethod, notes } = req.body;
      if (!patientId || !items || !Array.isArray(items) || items.length === 0) {
        return res
          .status(400)
          .json({ message: "Patient ID and items are required" });
      }
      const bill = await billService.createBill({
        patientId,
        doctorId,
        items,
        paymentMethod,
        notes,
      });
      res.status(201).json({ message: "Bill created successfully", bill });
    } catch (error) {
      console.error("Create bill error:", error);
      res.status(500).json({ message: "Failed to create bill" });
    }
  },

  async updatePayment(req, res) {
    try {
      const { id } = req.params;
      const { paidAmount, paymentMethod } = req.body;
      if (!paidAmount || paidAmount < 0) {
        return res
          .status(400)
          .json({ message: "Valid paid amount is required" });
      }
      const result = await billService.updateBillPayment(
        id,
        paidAmount,
        paymentMethod
      );
      if (!result) return res.status(404).json({ message: "Bill not found" });
      res.json({ message: "Payment updated successfully", ...result });
    } catch (error) {
      if (error.message === "Paid amount cannot exceed total amount") {
        return res.status(400).json({ message: error.message });
      }
      console.error("Update payment error:", error);
      res.status(500).json({ message: "Failed to update payment" });
    }
  },

  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const result = await billService.updateBillStatus(id, status);
      if (!result) return res.status(404).json({ message: "Bill not found" });
      res.json({ message: "Bill status updated successfully" });
    } catch (error) {
      if (error.message === "Invalid status") {
        return res.status(400).json({ message: error.message });
      }
      console.error("Update bill status error:", error);
      res.status(500).json({ message: "Failed to update bill status" });
    }
  },

  async remove(req, res) {
    try {
      const { id } = req.params;
      const result = await billService.deleteBill(id);
      if (!result) return res.status(404).json({ message: "Bill not found" });
      res.json({ message: "Bill deleted successfully" });
    } catch (error) {
      console.error("Delete bill error:", error);
      res.status(500).json({ message: "Failed to delete bill" });
    }
  },

  async statsOverview(req, res) {
    try {
      const stats = await billService.getStatsOverview();
      res.json(stats);
    } catch (error) {
      console.error("Get billing stats error:", error);
      res.status(500).json({ message: "Failed to fetch billing statistics" });
    }
  },
};

module.exports = billsController;

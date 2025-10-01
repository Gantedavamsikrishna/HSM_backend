// Bill Service (business logic)
const billRepository = require("../repositories/billsRepository");

const billService = {
  async getAllBills(query) {
    return billRepository.getAll(query);
  },
  async getBillById(id) {
    return billRepository.getById(id);
  },
  async createBill(data) {
    return billRepository.create(data);
  },
  async updateBillPayment(id, paidAmount, paymentMethod) {
    return billRepository.updatePayment(id, paidAmount, paymentMethod);
  },
  async updateBillStatus(id, status) {
    return billRepository.updateStatus(id, status);
  },
  async deleteBill(id) {
    return billRepository.remove(id);
  },
  async getStatsOverview() {
    return billRepository.getStatsOverview();
  },
};

module.exports = billService;

export class ProviderAdapter {
constructor(name) {
this.name = name;
}

async search(query) {
throw new Error("Provider search is not implemented");
}

async createOrder(order) {
throw new Error("Provider order is not implemented");
}

async getOrderStatus(orderId) {
throw new Error("Provider status is not implemented");
}
}

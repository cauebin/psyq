import 'dotenv/config';

const API_URL = 'https://api.abacatepay.com/v1';

export async function createPixCharge(amount: number, description: string, customer: any) {
  const apiKey = process.env.ABACATEPAY_API_KEY;
  if (!apiKey) {
    throw new Error('ABACATEPAY_API_KEY is not defined');
  }

  const response = await fetch(`${API_URL}/pixQrCode/create`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount, // Centavos
      expiresIn: 3600, // 1 hora
      description,
      customer: customer ? {
        name: customer.name,
        cellphone: customer.phone,
        email: customer.email,
        taxId: customer.cpf
      } : undefined
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AbacatePay Error: ${error}`);
  }

  const data = await response.json();
  return data.data;
}

export async function getPixCharge(chargeId: string) {
  const apiKey = process.env.ABACATEPAY_API_KEY;
  if (!apiKey) {
    throw new Error('ABACATEPAY_API_KEY is not defined');
  }

  const response = await fetch(`${API_URL}/billing/list`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AbacatePay Get Error: ${error}`);
  }

  const data = await response.json();
  // The list endpoint returns an array, we need to find our specific charge
  if (Array.isArray(data.data)) {
    return data.data.find((c: any) => c.id === chargeId);
  }
  return null;
}


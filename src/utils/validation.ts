export function validateCPF(cpf: string): boolean {
  const cleanCPF = cpf.replace(/\D/g, '');

  if (cleanCPF.length !== 11) return false;

  // Check for known invalid CPFs
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++) {
    sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  }

  remainder = (sum * 10) % 11;

  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  }

  remainder = (sum * 10) % 11;

  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;

  return true;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

export function formatCPF(cpf: string): string {
  let val = cpf.replace(/\D/g, '');
  if (val.length > 11) val = val.slice(0, 11);
  if (val.length > 9) return val.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (val.length > 6) return val.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
  if (val.length > 3) return val.replace(/(\d{3})(\d{1,3})/, '$1.$2');
  return val;
}

export function formatPhone(phone: string): string {
  let val = phone.replace(/\D/g, '');
  if (val.length > 11) val = val.slice(0, 11);
  if (val.length > 10) return val.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (val.length > 6) return val.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  if (val.length > 2) return val.replace(/(\d{2})(\d{0,5})/, '($1) $2');
  return val;
}

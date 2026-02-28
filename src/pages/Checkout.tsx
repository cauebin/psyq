import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, CreditCard, QrCode, Copy, CheckCircle2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';

interface UnpaidMonth {
  month: string;
  year: string;
  session_count: number;
  total_value: number;
}

// CRC16-CCITT-FALSE implementation for PIX
function crc16ccitt(str: string) {
  let crc = 0xFFFF;
  const strlen = str.length;
  for (let c = 0; c < strlen; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  let hex = (crc & 0xFFFF).toString(16).toUpperCase();
  if (hex.length < 4) hex = '0'.repeat(4 - hex.length) + hex;
  return hex;
}

function generatePixPayload(key: string, name: string, city: string, amount: string, txtId: string = '***') {
  const cleanKey = key.replace(/\s/g, '');
  // Normalize name and city to remove accents and limit length
  const cleanName = name.substring(0, 25).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cleanCity = city.substring(0, 15).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cleanAmount = parseFloat(amount).toFixed(2);

  // Field 26: Merchant Account Information
  // 00 (GUI) + 14 (len) + br.gov.bcb.pix
  // 01 (Key) + len + key
  const gui = '0014br.gov.bcb.pix';
  const keyField = `01${cleanKey.length.toString().padStart(2, '0')}${cleanKey}`;
  const merchantAccountInfoContent = gui + keyField;
  const merchantAccountInfo = `26${merchantAccountInfoContent.length.toString().padStart(2, '0')}${merchantAccountInfoContent}`;

  // Field 52: Merchant Category Code (0000 = Unspecified)
  const merchantCategoryCode = '52040000';

  // Field 53: Transaction Currency (986 = BRL)
  const transactionCurrency = '5303986';

  // Field 54: Transaction Amount
  const transactionAmount = `54${cleanAmount.length.toString().padStart(2, '0')}${cleanAmount}`;

  // Field 58: Country Code
  const countryCode = '5802BR';

  // Field 59: Merchant Name
  const merchantName = `59${cleanName.length.toString().padStart(2, '0')}${cleanName}`;

  // Field 60: Merchant City
  const merchantCity = `60${cleanCity.length.toString().padStart(2, '0')}${cleanCity}`;

  // Field 62: Additional Data Field Template
  // 05 (TxID) + len + value
  const txIdContent = `05${txtId.length.toString().padStart(2, '0')}${txtId}`;
  const additionalDataField = `62${txIdContent.length.toString().padStart(2, '0')}${txIdContent}`;

  // Field 63: CRC16 (04 bytes placeholder)
  const payloadWithoutCrc = 
    '000201' + 
    merchantAccountInfo + 
    merchantCategoryCode + 
    transactionCurrency + 
    transactionAmount + 
    countryCode + 
    merchantName + 
    merchantCity + 
    additionalDataField + 
    '6304';

  const crc = crc16ccitt(payloadWithoutCrc);
  return payloadWithoutCrc + crc;
}

export default function Checkout({ user }: { user: any }) {
  const [unpaidMonths, setUnpaidMonths] = useState<UnpaidMonth[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'selection' | 'pix' | 'success'>('selection');
  const [pixCode, setPixCode] = useState('');
  const [psychologistData, setPsychologistData] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUnpaid();
    fetchPsychologistData();
  }, []);

  const fetchPsychologistData = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.psychologist_id) {
        // Fetch psychologist details to get PIX key
        // We need an endpoint for this or include it in /api/auth/me if user is patient
        // Since we updated /api/auth/me to include psychologist_email, we might need more info
        // Let's fetch the psychologist public info or use a new endpoint
        // For now, let's assume we can get it from a specific endpoint or update /api/auth/me further
        // Actually, let's create a specific endpoint to get payment info
        const payRes = await fetch('/api/checkout/payment-info', {
           headers: { Authorization: `Bearer ${token}` }
        });
        if (payRes.ok) {
           const payData = await payRes.json();
           setPsychologistData(payData);
        }
      }
    } catch (err) {
      console.error('Error fetching psychologist data:', err);
    }
  };

  const fetchUnpaid = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/checkout/unpaid', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const sortedData = data.sort((a: any, b: any) => {
        if (a.year !== b.year) return parseInt(a.year) - parseInt(b.year);
        return parseInt(a.month) - parseInt(b.month);
      });
      setUnpaidMonths(sortedData);
    } catch (err) {
      console.error('Error fetching unpaid sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleMonth = (id: string) => {
    setSelectedMonths(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const totalToPay = unpaidMonths
    .filter(m => selectedMonths.includes(`${m.month}-${m.year}`))
    .reduce((acc, curr) => acc + curr.total_value, 0);

  const handlePay = () => {
    if (selectedMonths.length === 0) return;
    
    if (psychologistData && psychologistData.pixKey) {
      const code = generatePixPayload(
        psychologistData.pixKey,
        psychologistData.name,
        psychologistData.city || 'Brasilia',
        totalToPay.toString(),
        'PAGAMENTO'
      );
      setPixCode(code);
    }
    
    setPaymentStep('pix');
  };

  const confirmPayment = async () => {
    setPaying(true);
    const token = localStorage.getItem('token');
    
    try {
      // Pay for each selected month
      for (const monthId of selectedMonths) {
        const [month, year] = monthId.split('-');
        await fetch('/api/checkout/pay', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify({ month, year })
        });
      }
      setPaymentStep('success');
    } catch (err) {
      console.error('Error processing payment:', err);
    } finally {
      setPaying(false);
    }
  };

  const copyPix = () => {
    navigator.clipboard.writeText(pixCode);
    alert('Código PIX copiado!');
  };

  const monthNames: any = {
    '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
    '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
    '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Button 
        variant="ghost" 
        onClick={() => navigate('/')} 
        className="mb-6 text-stone-600 hover:text-stone-900"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Painel
      </Button>

      <AnimatePresence mode="wait">
        {paymentStep === 'selection' && (
          <motion.div
            key="selection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="border-stone-200 shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl font-serif">Checkout</CardTitle>
                <CardDescription>Selecione os meses que deseja quitar.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {unpaidMonths.length === 0 ? (
                  <div className="text-center py-12 text-stone-500 italic">
                    Você não possui pendências de pagamento.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {unpaidMonths.map((m) => {
                      const id = `${m.month}-${m.year}`;
                      return (
                        <div 
                          key={id}
                          className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                            selectedMonths.includes(id) 
                              ? 'border-stone-900 bg-stone-50 shadow-sm' 
                              : 'border-stone-100 hover:border-stone-300'
                          }`}
                          onClick={() => toggleMonth(id)}
                        >
                          <div className="flex items-center gap-4">
                            <Checkbox 
                              checked={selectedMonths.includes(id)}
                              onCheckedChange={() => toggleMonth(id)}
                            />
                            <div>
                              <p className="font-medium text-stone-900">
                                {monthNames[m.month]} {m.year}
                              </p>
                              <p className="text-xs text-stone-500">
                                {m.session_count} {m.session_count === 1 ? 'sessão' : 'sessões'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-stone-900">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(m.total_value)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
              {unpaidMonths.length > 0 && (
                <CardFooter className="flex flex-col border-t pt-6 bg-stone-50/50">
                  <div className="flex justify-between w-full mb-6">
                    <span className="text-stone-600 font-medium">Total Selecionado</span>
                    <span className="text-2xl font-bold text-stone-900">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalToPay)}
                    </span>
                  </div>
                  <Button 
                    className="w-full h-12 text-lg bg-stone-900 hover:bg-stone-800"
                    disabled={selectedMonths.length === 0}
                    onClick={handlePay}
                  >
                    <CreditCard className="mr-2 h-5 w-5" /> Pagar Agora
                  </Button>
                </CardFooter>
              )}
            </Card>
          </motion.div>
        )}

        {paymentStep === 'pix' && (
          <motion.div
            key="pix"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Card className="border-stone-200 shadow-2xl overflow-hidden">
              <div className="bg-stone-900 text-white p-6 text-center">
                <QrCode className="h-12 w-12 mx-auto mb-2 text-emerald-400" />
                <CardTitle className="text-xl">Pagamento via PIX</CardTitle>
                <p className="text-stone-400 text-sm">Escaneie o código abaixo para pagar</p>
              </div>
              <CardContent className="p-8 flex flex-col items-center">
                <div className="bg-white p-4 rounded-2xl border-2 border-stone-100 shadow-inner mb-8">
                  <QRCodeSVG value={pixCode} size={200} />
                </div>

                <div className="w-full space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-500">PIX Copia e Cola</label>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-stone-50 p-3 rounded-lg border border-stone-200 text-xs font-mono break-all line-clamp-2">
                        {pixCode}
                      </div>
                      <Button variant="outline" size="icon" onClick={copyPix} className="shrink-0">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex gap-3 items-start">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-emerald-900">Valor a pagar: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalToPay)}</p>
                      <p className="text-xs text-emerald-700">Após o pagamento, clique no botão abaixo para confirmar.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3 p-8 bg-stone-50/50 border-t">
                <Button 
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={confirmPayment}
                  disabled={paying}
                >
                  {paying ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
                  ) : (
                    'Já realizei o pagamento'
                  )}
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full text-stone-500"
                  onClick={() => setPaymentStep('selection')}
                  disabled={paying}
                >
                  Alterar meses selecionados
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        )}

        {paymentStep === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="bg-white p-12 rounded-3xl border border-stone-200 shadow-xl space-y-6">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-serif font-bold text-stone-900">Pagamento Confirmado!</h2>
                <p className="text-stone-500">Seus meses selecionados foram quitados com sucesso.</p>
              </div>
              <Button 
                className="w-full bg-stone-900 hover:bg-stone-800"
                onClick={() => navigate('/')}
              >
                Voltar ao Início
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

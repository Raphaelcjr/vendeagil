import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import {
  LayoutDashboard, Package, ShoppingCart, Users, Store, Plus,
  TrendingUp, DollarSign, AlertTriangle, CheckCircle2,
  Clock, Share2, LogOut, Trash2, Edit3,
  ShoppingBag, ChevronRight, X
} from 'lucide-react';

// Conexão direta com o seu Supabase
const SUPABASE_URL = 'https://fuflpsnzgxjklbnpxnmb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_1WCq0kfmxHF2HTolNBYtuQ_9q8nYSNf';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const formatBRL = (val) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

function App() {
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isPublicCatalog, setIsPublicCatalog] = useState(false);
  const [ownerIdFromUrl, setOwnerIdFromUrl] = useState(null);

  // Estados de Auth
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authMsg, setAuthMsg] = useState('');

  // Navegação e Dados
  const [tab, setTab] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // Modais
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  // Carrinho do Catálogo Público
  const [cart, setCart] = useState([]);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [catalogCustomer, setCatalogCustomer] = useState({ name: '', phone: '', payment: 'Pix' });
  const [orderSentSuccess, setOrderSentSuccess] = useState(false);

  // Detecta se abriu pelo link público (?loja=ID)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loja = params.get('loja');
    if (loja) {
      setIsPublicCatalog(true);
      setOwnerIdFromUrl(loja);
      fetchPublicProducts(loja);
      setLoadingAuth(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingAuth(false);
      if (session) fetchAllData(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchAllData(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchPublicProducts = async (userId) => {
    setLoadingData(true);
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .order('created_at', { ascending: false });
    setProducts(data || []);
    setLoadingData(false);
  };

  const fetchAllData = async (userId) => {
    setLoadingData(true);
    const [prodRes, custRes, ordRes] = await Promise.all([
      supabase.from('products').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('customers').select('*').eq('user_id', userId).order('name', { ascending: true }),
      supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    ]);
    setProducts(prodRes.data || []);
    setCustomers(custRes.data || []);
    setOrders(ordRes.data || []);
    setLoadingData(false);
  };

  // Login / Cadastro
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthMsg('');
    if (authMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthError('E-mail ou senha incorretos.');
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setAuthError(error.message);
      else if (data?.user && !data?.session) {
        setAuthMsg('Conta criada! Verifique seu e-mail para confirmar (ou desative a confirmação no Supabase).');
      }
    }
  };

  // Salvar Produto
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const payload = {
      user_id: session.user.id,
      name: form.get('name'),
      category: form.get('category') || 'Geral',
      cost_price: parseFloat(form.get('cost_price')) || 0,
      sell_price: parseFloat(form.get('sell_price')) || 0,
      stock: parseInt(form.get('stock')) || 0,
      min_stock: parseInt(form.get('min_stock')) || 3,
      image_url: form.get('image_url') || '',
      active: true
    };

    if (editingProduct) {
      await supabase.from('products').update(payload).eq('id', editingProduct.id);
    } else {
      await supabase.from('products').insert([payload]);
    }
    setShowProductModal(false);
    setEditingProduct(null);
    fetchAllData(session.user.id);
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm('Excluir este produto?')) return;
    await supabase.from('products').delete().eq('id', id);
    fetchAllData(session.user.id);
  };

  // Salvar Cliente
  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    await supabase.from('customers').insert([{
      user_id: session.user.id,
      name: form.get('name'),
      phone: form.get('phone'),
      notes: form.get('notes')
    }]);
    setShowCustomerModal(false);
    fetchAllData(session.user.id);
  };

  // Registrar Nova Venda (Admin)
  const [saleItems, setSaleItems] = useState([]);
  const [saleMeta, setSaleMeta] = useState({
    customer_name: 'Cliente Balcão',
    channel: 'WhatsApp',
    payment_method: 'Pix',
    card_fee_percent: 0,
    discount: 0,
    status: 'paid'
  });

  const addSaleItem = (prodId) => {
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;
    setSaleItems(prev => {
      const exists = prev.find(i => i.id === prod.id);
      if (exists) return prev.map(i => i.id === prod.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: prod.id, name: prod.name, price: Number(prod.sell_price), cost: Number(prod.cost_price), qty: 1 }];
    });
  };

  const handleCreateSale = async (e) => {
    e.preventDefault();
    if (saleItems.length === 0) return alert('Adicione pelo menos 1 produto.');

    const subtotal = saleItems.reduce((acc, i) => acc + i.price * i.qty, 0);
    const totalCost = saleItems.reduce((acc, i) => acc + i.cost * i.qty, 0);
    const discount = Number(saleMeta.discount) || 0;
    const total = Math.max(0, subtotal - discount);
    const feeValue = total * ((Number(saleMeta.card_fee_percent) || 0) / 100);
    const netProfit = total - totalCost - feeValue;

    await supabase.from('orders').insert([{
      user_id: session.user.id,
      customer_name: saleMeta.customer_name || 'Cliente Balcão',
      channel: saleMeta.channel,
      payment_method: saleMeta.payment_method,
      card_fee_percent: Number(saleMeta.card_fee_percent) || 0,
      discount,
      total_amount: total,
      net_profit: netProfit,
      status: saleMeta.status,
      items: saleItems
    }]);

    for (const item of saleItems) {
      const p = products.find(pr => pr.id === item.id);
      if (p) {
        await supabase.from('products').update({ stock: Math.max(0, p.stock - item.qty) }).eq('id', p.id);
      }
    }

    setSaleItems([]);
    setShowSaleModal(false);
    fetchAllData(session.user.id);
  };

  // Atualizar Status do Pedido (Pagar / Cancelar)
  const handleOrderStatus = async (order, newStatus) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', order.id);
    if (newStatus === 'cancelled' && order.status !== 'cancelled') {
      for (const item of order.items || []) {
        const p = products.find(pr => pr.id === item.id);
        if (p) {
          await supabase.from('products').update({ stock: p.stock + item.qty }).eq('id', p.id);
        }
      }
    }
    fetchAllData(session.user.id);
  };

  // Enviar Pedido pelo Catálogo Público
  const handlePublicOrderSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return;
    const total = cart.reduce((acc, i) => acc + Number(i.sell_price) * i.qty, 0);
    const totalCost = cart.reduce((acc, i) => acc + Number(i.cost_price || 0) * i.qty, 0);

    await supabase.from('orders').insert([{
      user_id: ownerIdFromUrl,
      customer_name: catalogCustomer.name,
      customer_phone: catalogCustomer.phone,
      channel: 'Catálogo Online',
      payment_method: catalogCustomer.payment,
      total_amount: total,
      net_profit: total - totalCost,
      status: 'pending',
      items: cart.map(c => ({ id: c.id, name: c.name, price: Number(c.sell_price), cost: Number(c.cost_price || 0), qty: c.qty }))
    }]);

    for (const item of cart) {
      await supabase.from('products').update({ stock: Math.max(0, item.stock - item.qty) }).eq('id', item.id);
    }

    setCart([]);
    setShowCartDrawer(false);
    setOrderSentSuccess(true);
    fetchPublicProducts(ownerIdFromUrl);
  };

  const copyCatalogLink = () => {
    const url = `${window.location.origin}/?loja=${session.user.id}`;
    navigator.clipboard.writeText(url);
    alert('Link do seu catálogo copiado! Agora é só colar no WhatsApp para seus clientes:\n\n' + url);
  };

  // Métricas Dashboard
  const stats = useMemo(() => {
    const validOrders = orders.filter(o => o.status !== 'cancelled');
    const revenue = validOrders.reduce((acc, o) => acc + Number(o.total_amount), 0);
    const profit = validOrders.reduce((acc, o) => acc + Number(o.net_profit), 0);
    const pending = orders.filter(o => o.status === 'pending').reduce((acc, o) => acc + Number(o.total_amount), 0);
    const lowStock = products.filter(p => p.stock <= p.min_stock);
    return { revenue, profit, pending, count: validOrders.length, lowStock };
  }, [orders, products]);

  // MODO CATÁLOGO PÚBLICO (CLIENTE)
  if (isPublicCatalog) {
    const cartTotal = cart.reduce((acc, i) => acc + Number(i.sell_price) * i.qty, 0);
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-100 pb-24">
        <header className="sticky top-0 z-30 bg-[#0d1320]/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-base leading-tight">Catálogo VendeÁgil</h1>
                <p className="text-xs text-emerald-400">Faça seu pedido online</p>
              </div>
            </div>
            <button
              onClick={() => setShowCartDrawer(true)}
              className="relative bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-3.5 py-2 rounded-xl text-sm flex items-center gap-2 transition"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Sacola ({cart.reduce((a, b) => a + b.qty, 0)})</span>
            </button>
          </div>
        </header>

        <main className="max-w-3xl mx-auto p-4">
          {orderSentSuccess && (
            <div className="mb-5 p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-300">Pedido enviado com sucesso!</p>
                  <p className="text-xs text-slate-300">O vendedor já recebeu seu pedido no painel.</p>
                </div>
              </div>
              <button onClick={() => setOrderSentSuccess(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
          )}

          {loadingData ? (
            <p className="text-center text-slate-400 py-12">Carregando produtos...</p>
          ) : products.length === 0 ? (
            <div className="text-center py-16 bg-[#111827] rounded-2xl border border-slate-800">
              <Package className="w-10 h-10 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-300 font-medium">Nenhum produto disponível no momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {products.map(prod => (
                <div key={prod.id} className="bg-[#111827] border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        {prod.category}
                      </span>
                      <span className={`text-[11px] font-medium ${prod.stock > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {prod.stock > 0 ? `${prod.stock} disponíveis` : 'Esgotado'}
                      </span>
                    </div>
                    <h3 className="font-semibold text-base mt-2 text-white">{prod.name}</h3>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-lg font-bold text-emerald-400">{formatBRL(prod.sell_price)}</span>
                    <button
                      disabled={prod.stock <= 0}
                      onClick={() => {
                        setCart(prev => {
                          const found = prev.find(i => i.id === prod.id);
                          if (found) {
                            if (found.qty >= prod.stock) return prev;
                            return prev.map(i => i.id === prod.id ? { ...i, qty: i.qty + 1 } : i);
                          }
                          return [...prev, { ...prod, qty: 1 }];
                        });
                      }}
                      className="bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs px-3.5 py-2 rounded-xl transition"
                    >
                      {prod.stock > 0 ? '+ Adicionar' : 'Indisponível'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Drawer Sacola */}
        {showCartDrawer && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-[#111827] border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg">Sua Sacola</h2>
                <button onClick={() => setShowCartDrawer(false)} className="p-1.5 rounded-lg bg-slate-800 text-slate-400"><X className="w-4 h-4" /></button>
              </div>
              {cart.length === 0 ? (
                <p className="text-slate-400 text-sm py-8 text-center">Sua sacola está vazia.</p>
              ) : (
                <form onSubmit={handlePublicOrderSubmit} className="space-y-4">
                  <div className="space-y-2">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center justify-between bg-[#090d16] p-3 rounded-xl border border-slate-800">
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-emerald-400">{item.qty}x {formatBRL(item.sell_price)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCart(prev => prev.filter(i => i.id !== item.id))}
                          className="text-rose-400 text-xs hover:underline"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between font-bold text-base pt-2 border-t border-slate-800">
                    <span>Total do Pedido</span>
                    <span className="text-emerald-400">{formatBRL(cartTotal)}</span>
                  </div>
                  <div className="space-y-2.5 pt-2">
                    <input
                      required
                      placeholder="Seu nome completo"
                      value={catalogCustomer.name}
                      onChange={e => setCatalogCustomer({ ...catalogCustomer, name: e.target.value })}
                      className="w-full bg-[#090d16] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm"
                    />
                    <input
                      required
                      placeholder="Seu WhatsApp (com DDD)"
                      value={catalogCustomer.phone}
                      onChange={e => setCatalogCustomer({ ...catalogCustomer, phone: e.target.value })}
                      className="w-full bg-[#090d16] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm"
                    />
                    <select
                      value={catalogCustomer.payment}
                      onChange={e => setCatalogCustomer({ ...catalogCustomer, payment: e.target.value })}
                      className="w-full bg-[#090d16] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm"
                    >
                      <option value="Pix">Pagar via Pix</option>
                      <option value="Cartão">Cartão de Crédito/Débito</option>
                      <option value="Dinheiro">Dinheiro na entrega</option>
                    </select>
                  </div>
                  <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl text-sm">
                    Finalizar Pedido
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loadingAuth) {
    return <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-slate-400">Carregando VendeÁgil...</div>;
  }

  // TELA DE LOGIN / CADASTRO
  if (!session) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#111827] border border-slate-800 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">VendeÁgil</h1>
              <p className="text-xs text-slate-400">Gestão sincronizada na nuvem</p>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-3.5">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Seu E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="voce@email.com"
                className="w-full bg-[#090d16] border border-slate-700 focus:border-emerald-500 outline-none rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full bg-[#090d16] border border-slate-700 focus:border-emerald-500 outline-none rounded-xl px-3.5 py-

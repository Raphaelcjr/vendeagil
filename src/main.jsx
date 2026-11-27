import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import {
  LayoutDashboard, Package, ShoppingCart, Users, Store, Plus,
  TrendingUp, DollarSign, AlertTriangle, CheckCircle2,
  Clock, Share2, LogOut, Trash2, Edit3,
  ShoppingBag, ChevronRight, ChevronDown, X, Calendar, PackagePlus, Wallet,
  Settings, User, CreditCard
} from 'lucide-react';

const SUPABASE_URL = 'https://fuflpsnzgxjklbnpxnmb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_1WCq0kfmxHF2HTolNBYtuQ_9q8nYSNf';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const formatBRL = (val) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

const getTodayISO = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
};

const getCurrentMonthKey = () => getTodayISO().slice(0, 7);

const getRecordMonthKey = (record, dateField) => {
  const rawDate = record?.[dateField] || record?.created_at;
  if (!rawDate) return '';
  const str = String(rawDate).slice(0, 10);
  const parts = str.split('-');
  if (parts.length < 2) return '';
  const year = parts[0];
  const month = parts[1].padStart(2, '0');
  if (year.length !== 4 || Number(month) < 1 || Number(month) > 12) return 'invalid-date';
  return `${year}-${month}`;
};

const formatMonthLabel = (ym) => {
  if (!ym || ym === 'all') return 'Todos os meses';
  if (ym === 'invalid-date') return 'Datas com erro (corrigir)';
  const [year, month] = ym.split('-');
  const months = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];
  const mIdx = Number(month) - 1;
  if (!year || year.length !== 4 || mIdx < 0 || mIdx > 11) {
    return `Data inválida (${ym})`;
  }
  return `${months[mIdx]}/${year}`;
};

const formatShortDate = (dateStr) => {
  if (!dateStr) return 'Sem data';
  const clean = String(dateStr).slice(0, 10);
  const [y, m, d] = clean.split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
};

const normalizeDateInput = (raw) => {
  if (!raw) return getTodayISO();
  const clean = String(raw).slice(0, 10);
  const parts = clean.split('-');
  if (parts.length === 3 && parts[0].length === 4) return clean;
  return getTodayISO();
};

const isLowStockProduct = (p) => {
  const min = Number(p.min_stock ?? 0);
  if (min <= 0) return false;
  return Number(p.stock ?? 0) <= min;
};

function App() {
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isPublicCatalog, setIsPublicCatalog] = useState(false);
  const [ownerIdFromUrl, setOwnerIdFromUrl] = useState(null);

  const [accountProfile, setAccountProfile] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('vendeagil_account_profile') || '{}');
      return {
        store_name: saved.store_name || localStorage.getItem('vendeagil_store_name') || '',
        full_name: saved.full_name || '',
        phone: saved.phone || '',
        city: saved.city || ''
      };
    } catch {
      return { store_name: '', full_name: '', phone: '', city: '' };
    }
  });

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsSection, setSettingsSection] = useState('account');
  const [profileForm, setProfileForm] = useState({
    store_name: '',
    full_name: '',
    phone: '',
    city: ''
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState('');

  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authMsg, setAuthMsg] = useState('');

  const [tab, setTab] = useState('dashboard');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());

  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [purchaseForm, setPurchaseForm] = useState({
    product_id: '',
    product_name: '',
    quantity: 1,
    total_cost: '',
    purchase_date: getTodayISO()
  });

  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  const [cart, setCart] = useState([]);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [catalogCustomer, setCatalogCustomer] = useState({ name: '', phone: '', payment: 'Pix' });
  const [orderSentSuccess, setOrderSentSuccess] = useState(false);

  const syncUserAccount = (currentSession) => {
    const meta = currentSession?.user?.user_metadata || {};
    const uid = currentSession?.user?.id;
    let localByUser = {};
    if (uid) {
      try {
        localByUser = JSON.parse(localStorage.getItem(`vendeagil_profile_${uid}`) || '{}');
      } catch {
        localByUser = {};
      }
    }

    const merged = {
      store_name: (meta.store_name ?? localByUser.store_name ?? localStorage.getItem('vendeagil_store_name') ?? '').trim(),
      full_name: (meta.full_name ?? localByUser.full_name ?? '').trim(),
      phone: (meta.phone ?? localByUser.phone ?? '').trim(),
      city: (meta.city ?? localByUser.city ?? '').trim()
    };

    setAccountProfile(merged);
    localStorage.setItem('vendeagil_account_profile', JSON.stringify(merged));
    if (merged.store_name) {
      localStorage.setItem('vendeagil_store_name', merged.store_name);
    }
    if (uid) {
      localStorage.setItem(`vendeagil_profile_${uid}`, JSON.stringify(merged));
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loja = params.get('loja');
    if (loja) {
      setIsPublicCatalog(true);
      setOwnerIdFromUrl(loja);
      try {
        const savedByOwner = JSON.parse(localStorage.getItem(`vendeagil_profile_${loja}`) || '{}');
        const legacyName = localStorage.getItem(`vendeagil_store_name_${loja}`) || '';
        const nameToUse = savedByOwner.store_name || legacyName;
        if (nameToUse) {
          setAccountProfile(prev => ({ ...prev, store_name: nameToUse }));
        }
      } catch {
        // ignore storage parse error
      }
      fetchPublicProducts(loja);
      setLoadingAuth(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      syncUserAccount(session);
      setLoadingAuth(false);
      if (session) fetchAllData(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      syncUserAccount(session);
      if (session) fetchAllData(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const openSettings = () => {
    setProfileForm({
      store_name: accountProfile.store_name || '',
      full_name: accountProfile.full_name || '',
      phone: accountProfile.phone || '',
      city: accountProfile.city || ''
    });
    setProfileSavedMsg('');
    setSettingsSection('account');
    setShowSettingsModal(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSavedMsg('');

    const cleaned = {
      store_name: profileForm.store_name.trim(),
      full_name: profileForm.full_name.trim(),
      phone: profileForm.phone.trim(),
      city: profileForm.city.trim()
    };

    setAccountProfile(cleaned);
    localStorage.setItem('vendeagil_account_profile', JSON.stringify(cleaned));
    localStorage.setItem('vendeagil_store_name', cleaned.store_name);

    if (session?.user?.id) {
      localStorage.setItem(`vendeagil_profile_${session.user.id}`, JSON.stringify(cleaned));
      localStorage.setItem(`vendeagil_store_name_${session.user.id}`, cleaned.store_name);
      await supabase.auth.updateUser({ data: cleaned });
    }

    setSavingProfile(false);
    setProfileSavedMsg('Dados salvos com sucesso!');
    setTimeout(() => setProfileSavedMsg(''), 3000);
  };

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
    const [prodRes, custRes, ordRes, purRes] = await Promise.all([
      supabase.from('products').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('customers').select('*').eq('user_id', userId).order('name', { ascending: true }),
      supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('purchases').select('*').eq('user_id', userId).order('purchase_date', { ascending: false })
    ]);
    setProducts(prodRes.data || []);
    setCustomers(custRes.data || []);
    setOrders(ordRes.data || []);
    setPurchases(purRes.data || []);
    setLoadingData(false);
  };

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
        setAuthMsg('Conta criada! Verifique seu e-mail para confirmar.');
      }
    }
  };

  const getProductLatestPurchase = (prod) => {
    if (!prod) return null;
    return (
      purchases.find(pur => pur.product_id === prod.id) ||
      purchases.find(pur => pur.product_name && pur.product_name.toLowerCase() === prod.name.toLowerCase()) ||
      null
    );
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const costPrice = parseFloat(form.get('cost_price')) || 0;
    const rawStock = form.get('stock');
    const stock = rawStock === '' || rawStock === null ? 0 : Math.max(0, parseInt(rawStock, 10) || 0);
    const rawMinStock = form.get('min_stock');
    const minStock = rawMinStock === '' || rawMinStock === null ? 3 : Math.max(0, parseInt(rawMinStock, 10) || 0);
    const purchaseDate = form.get('purchase_date') || getTodayISO();

    const payload = {
      user_id: session.user.id,
      name: form.get('name'),
      category: form.get('category') || 'Geral',
      cost_price: costPrice,
      sell_price: parseFloat(form.get('sell_price')) || 0,
      stock,
      min_stock: minStock,
      image_url: form.get('image_url') || '',
      active: true
    };

    if (editingProduct) {
      await supabase.from('products').update(payload).eq('id', editingProduct.id);
      const linkedPurchase = getProductLatestPurchase(editingProduct);
      if (linkedPurchase) {
        await supabase
          .from('purchases')
          .update({
            product_id: editingProduct.id,
            product_name: payload.name,
            purchase_date: purchaseDate
          })
          .eq('id', linkedPurchase.id);
      } else if (costPrice > 0) {
        const qtyForRecord = stock > 0 ? stock : 1;
        await supabase.from('purchases').insert([{
          user_id: session.user.id,
          product_id: editingProduct.id,
          product_name: payload.name,
          quantity: qtyForRecord,
          unit_cost: costPrice,
          total_cost: Number((qtyForRecord * costPrice).toFixed(2)),
          purchase_date: purchaseDate
        }]);
      }
    } else {
      const { data: created } = await supabase.from('products').insert([payload]).select().single();
      if (stock > 0 && costPrice > 0) {
        await supabase.from('purchases').insert([{
          user_id: session.user.id,
          product_id: created?.id || null,
          product_name: payload.name,
          quantity: stock,
          unit_cost: costPrice,
          total_cost: Number((stock * costPrice).toFixed(2)),
          purchase_date: purchaseDate
        }]);
      }
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

  const openPurchaseModal = (preselectedProduct = null) => {
    setEditingPurchase(null);
    const target = preselectedProduct || products[0];
    setPurchaseForm({
      product_id: target ? target.id : '',
      product_name: target ? target.name : '',
      quantity: 1,
      total_cost: target ? String(Number(target.cost_price) || '') : '',
      purchase_date: getTodayISO()
    });
    setShowPurchaseModal(true);
  };

  const openEditPurchaseModal = (pur) => {
    setEditingPurchase(pur);
    const matchedProd = products.find(p => p.id === pur.product_id) || products.find(p => p.name === pur.product_name);
    setPurchaseForm({
      product_id: matchedProd ? matchedProd.id : (pur.product_id || ''),
      product_name: pur.product_name || matchedProd?.name || '',
      quantity: pur.quantity || 1,
      total_cost: String(Number(pur.total_cost) || 0),
      purchase_date: normalizeDateInput(pur.purchase_date)
    });
    setShowPurchaseModal(true);
  };

  const handleSavePurchase = async (e) => {
    e.preventDefault();
    const prod = products.find(p => p.id === purchaseForm.product_id);
    const qty = Math.max(1, parseInt(purchaseForm.quantity) || 1);
    const totalCost = Math.max(0, parseFloat(purchaseForm.total_cost) || 0);
    const unitCost = qty > 0 ? Number((totalCost / qty).toFixed(2)) : 0;
    const pDate = purchaseForm.purchase_date || getTodayISO();
    const finalName = prod ? prod.name : (purchaseForm.product_name || 'Reposição de Estoque');

    if (editingPurchase) {
      await supabase
        .from('purchases')
        .update({
          product_id: prod ? prod.id : editingPurchase.product_id,
          product_name: finalName,
          quantity: qty,
          unit_cost: unitCost,
          total_cost: totalCost,
          purchase_date: pDate
        })
        .eq('id', editingPurchase.id);
    } else {
      await supabase.from('purchases').insert([{
        user_id: session.user.id,
        product_id: prod ? prod.id : null,
        product_name: finalName,
        quantity: qty,
        unit_cost: unitCost,
        total_cost: totalCost,
        purchase_date: pDate
      }]);

      if (prod) {
        const updatePayload = { stock: Number(prod.stock || 0) + qty };
        if (unitCost > 0) updatePayload.cost_price = unitCost;
        await supabase.from('products').update(updatePayload).eq('id', prod.id);
      }
    }

    setEditingPurchase(null);
    setShowPurchaseModal(false);
    fetchAllData(session.user.id);
  };

  const handleDeletePurchase = async (id) => {
    if (!confirm('Excluir este registro de compra?')) return;
    await supabase.from('purchases').delete().eq('id', id);
    fetchAllData(session.user.id);
  };

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

  const [saleItems, setSaleItems] = useState([]);
  const [saleMeta, setSaleMeta] = useState({
    customer_name: 'Cliente Balcão',
    channel: 'WhatsApp',
    payment_method: 'Pix',
    card_fee_percent: 0,
    discount: 0,
    status: 'paid',
    sale_date: getTodayISO()
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
    const sDate = saleMeta.sale_date || getTodayISO();

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
      sale_date: sDate,
      items: saleItems
    }]);

    for (const item of saleItems) {
      const p = products.find(pr => pr.id === item.id);
      if (p) {
        await supabase.from('products').update({ stock: Math.max(0, p.stock - item.qty) }).eq('id', p.id);
      }
    }

    setSaleItems([]);
    setSaleMeta(prev => ({ ...prev, sale_date: getTodayISO(), discount: 0 }));
    setShowSaleModal(false);
    fetchAllData(session.user.id);
  };

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
      sale_date: getTodayISO(),
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
    alert('Link do seu catálogo copiado:\n\n' + url);
  };

  const resolvePurchaseProductName = (pur) => {
    if (pur.product_name && pur.product_name !== 'Reposição de Estoque') return pur.product_name;
    const found = products.find(p => p.id === pur.product_id);
    return found ? found.name : (pur.product_name || 'Produto não identificado');
  };

  const availableMonths = useMemo(() => {
    const set = new Set([getCurrentMonthKey()]);
    orders.forEach(o => {
      const m = getRecordMonthKey(o, 'sale_date');
      if (m) set.add(m);
    });
    purchases.forEach(p => {
      const m = getRecordMonthKey(p, 'purchase_date');
      if (m) set.add(m);
    });
    return Array.from(set).sort().reverse();
  }, [orders, purchases]);

  const filteredOrders = useMemo(() => {
    if (selectedMonth === 'all') return orders;
    return orders.filter(o => getRecordMonthKey(o, 'sale_date') === selectedMonth);
  }, [orders, selectedMonth]);

  const filteredPurchases = useMemo(() => {
    if (selectedMonth === 'all') return purchases;
    return purchases.filter(p => getRecordMonthKey(p, 'purchase_date') === selectedMonth);
  }, [purchases, selectedMonth]);

  const stats = useMemo(() => {
    const validOrders = filteredOrders.filter(o => o.status !== 'cancelled');
    const revenue = validOrders.reduce((acc, o) => acc + Number(o.total_amount), 0);
    const unitsSold = validOrders.reduce(
      (acc, o) => acc + (o.items || []).reduce((s, item) => s + (Number(item.qty) || 0), 0),
      0
    );
    const profit = validOrders.reduce((acc, o) => acc + Number(o.net_profit), 0);
    const pending = filteredOrders
      .filter(o => o.status === 'pending')
      .reduce((acc, o) => acc + Number(o.total_amount), 0);
    const spentInPurchases = filteredPurchases.reduce((acc, p) => acc + Number(p.total_cost), 0);
    const lowStock = products.filter(isLowStockProduct);

    const stockPotentialRevenue = products.reduce(
      (acc, p) => acc + Math.max(0, Number(p.stock || 0)) * Number(p.sell_price || 0),
      0
    );
    const stockUnitsTotal = products.reduce(
      (acc, p) => acc + Math.max(0, Number(p.stock || 0)),
      0
    );

    return {
      revenue,
      unitsSold,
      profit,
      pending,
      spentInPurchases,
      stockPotentialRevenue,
      stockUnitsTotal,
      count: validOrders.length,
      lowStock
    };
  }, [filteredOrders, filteredPurchases, products]);

  const brandHeaderTitle = accountProfile.store_name || accountProfile.full_name || 'VendeÁgil';
  const brandHeaderSubtitle = (accountProfile.store_name || accountProfile.full_name)
    ? `VendeÁgil • ${session?.user?.email || ''}`
    : (session?.user?.email || '');

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
                <h1 className="font-bold text-base leading-tight">
                  {accountProfile.store_name ? `${accountProfile.store_name} • Catálogo` : 'Catálogo VendeÁgil'}
                </h1>
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
                className="w-full bg-[#090d16] border border-slate-700 focus:border-emerald-500 outline-none rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>

            {authError && <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-lg">{authError}</p>}
            {authMsg && <p className="text-xs text-emerald-400 bg-emerald-500/10 p-2.5 rounded-lg">{authMsg}</p>}

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl text-sm transition"
            >
              {authMode === 'login' ? 'Entrar no Painel' : 'Criar Minha Conta'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-800 text-center">
            <button
              onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); setAuthMsg(''); }}
              className="text-xs text-emerald-400 hover:underline"
            >
              {authMode === 'login' ? 'Primeiro acesso? Criar conta agora' : 'Já tenho conta? Fazer login'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const editingProductLinkedPurchase = editingProduct ? getProductLatestPurchase(editingProduct) : null;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 pb-24 md:pb-8">
      <header className="sticky top-0 z-30 bg-[#0d1320]/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-base leading-none truncate">
                {brandHeaderTitle}
              </h1>
              <span className="text-[11px] text-slate-400 truncate block mt-0.5">
                {brandHeaderSubtitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={copyCatalogLink}
              className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Link Catálogo</span>
            </button>
            <button
              onClick={() => {
                setSaleMeta(prev => ({ ...prev, sale_date: getTodayISO() }));
                setShowSaleModal(true);
              }}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Venda</span>
            </button>
            <button
              onClick={openSettings}
              title="Configurações da Conta"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/70 transition"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 pt-4 hidden md:flex gap-2">
        {[
          { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
          { id: 'orders', label: 'Pedidos & Vendas', icon: ShoppingCart },
          { id: 'products', label: 'Produtos & Compras', icon: Package },
          { id: 'customers', label: 'Clientes', icon: Users }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
              tab === item.id
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-[#111827] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        ))}
      </div>

      <main className="max-w-5xl mx-auto p-4 space-y-5">
        <div className="bg-[#111827] border border-slate-800 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">Período analisado:</span>
            <span className="text-emerald-400 font-bold">{formatMonthLabel(selectedMonth)}</span>
          </div>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="bg-[#090d16] border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-white outline-none focus:border-emerald-500"
          >
            <option value="all">Todos os meses</option>
            {availableMonths.map(m => (
              <option key={m} value={m}>{formatMonthLabel(m)}</option>
            ))}
          </select>
        </div>

        {tab === 'dashboard' && (
          <>
            {(products.length === 0 || orders.length === 0) && (
              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="font-bold text-sm text-white">Primeiros passos</h2>
                    <p className="text-xs text-slate-400">Configure o essencial em poucos minutos</p>
                  </div>
                  <span className="text-xs text-emerald-400 font-semibold">
                    {[products.length > 0, orders.length > 0].filter(Boolean).length} de 2 concluídos
                  </span>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => { setEditingProduct(null); setShowProductModal(true); }}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-[#090d16] border border-slate-800 hover:border-emerald-500/40 text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className={`w-4 h-4 ${products.length > 0 ? 'text-emerald-400' : 'text-slate-600'}`} />
                      <span className="text-xs font-medium">Cadastrar primeiro produto</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>
                  <button
                    onClick={() => setShowSaleModal(true)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-[#090d16] border border-slate-800 hover:border-emerald-500/40 text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className={`w-4 h-4 ${orders.length > 0 ? 'text-emerald-400' : 'text-slate-600'}`} />
                      <span className="text-xs font-medium">Registrar primeira venda</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Faturamento
                </span>
                <p className="text-xl font-bold text-white mt-1.5">{formatBRL(stats.revenue)}</p>
                <span className="text-[11px] text-slate-500">
                  {stats.count} vendas • {stats.unitsSold} un. vendidas
                </span>
              </div>

              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <PackagePlus className="w-3.5 h-3.5 text-sky-400" /> Gasto em Compras
                </span>
                <p className="text-xl font-bold text-sky-400 mt-1.5">{formatBRL(stats.spentInPurchases)}</p>
                <span className="text-[11px] text-slate-500">
                  {filteredPurchases.length} compras no período
                </span>
              </div>

              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Lucro Líquido
                </span>
                <p className="text-xl font-bold text-emerald-400 mt-1.5">{formatBRL(stats.profit)}</p>
                <span className="text-[11px] text-slate-500">Descontando custo e taxa</span>
              </div>

              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-violet-400" /> Valor em Estoque
                </span>
                <p className="text-xl font-bold text-violet-400 mt-1.5">{formatBRL(stats.stockPotentialRevenue)}</p>
                <span className="text-[11px] text-slate-500">
                  {stats.stockUnitsTotal} un. a vender
                </span>
              </div>

              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 col-span-2 lg:col-span-1">
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" /> A Receber
                </span>
                <p className="text-xl font-bold text-amber-400 mt-1.5">{formatBRL(stats.pending)}</p>
                <span className="text-[11px] text-slate-500">Pedidos pendentes / fiado</span>
              </div>
            </div>

            {stats.lowStock.length > 0 && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4">
                <h3 className="text-xs font-bold text-rose-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Atenção ao Estoque ({stats.lowStock.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {stats.lowStock.map(p => (
                    <span key={p.id} className="text-xs bg-[#090d16] border border-rose-500/30 px-2.5 py-1 rounded-lg text-slate-200">
                      {p.name}: <strong className="text-rose-400">{p.stock} un.</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm">Últimas Vendas ({formatMonthLabel(selectedMonth)})</h3>
                <button onClick={() => setTab('orders')} className="text-xs text-emerald-400 hover:underline">Ver todas</button>
              </div>
              {filteredOrders.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">Nenhuma venda registrada neste período.</p>
              ) : (
                <div className="space-y-2.5">
                  {filteredOrders.slice(0, 5).map(ord => (
                    <div key={ord.id} className="flex items-center justify-between p-3 rounded-xl bg-[#090d16] border border-slate-800/80">
                      <div>
                        <p className="text-sm font-semibold">{ord.customer_name}</p>
                        <p className="text-xs text-slate-400">
                          {formatShortDate(ord.sale_date || ord.created_at)} • {ord.channel} • {ord.payment_method}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-400">{formatBRL(ord.total_amount)}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          ord.status === 'paid' ? 'bg-emerald-500/15 text-emerald-400' :
                          ord.status === 'pending' ? 'bg-amber-500/15 text-amber-400' : 'bg-rose-500/15 text-rose-400'
                        }`}>
                          {ord.status === 'paid' ? 'Pago' : ord.status === 'pending' ? 'Pendente' : 'Cancelado'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'orders' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Pedidos e Vendas ({filteredOrders.length})</h2>
              <button
                onClick={() => {
                  setSaleMeta(prev => ({ ...prev, sale_date: getTodayISO() }));
                  setShowSaleModal(true);
                }}
                className="bg-emerald-500 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl"
              >
                + Nova Venda
              </button>
            </div>
            {filteredOrders.length === 0 ? (
              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
                Nenhuma venda encontrada para {formatMonthLabel(selectedMonth)}.
              </div>
            ) : (
              filteredOrders.map(ord => (
                <div key={ord.id} className="bg-[#111827] border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md">{ord.channel}</span>
                        <span className="text-[11px] text-slate-400">Data: {formatShortDate(ord.sale_date || ord.created_at)}</span>
                      </div>
                      <h3 className="font-bold text-base mt-1">{ord.customer_name}</h3>
                      {ord.customer_phone && <p className="text-xs text-slate-400">WhatsApp: {ord.customer_phone}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-emerald-400">{formatBRL(ord.total_amount)}</p>
                      <p className="text-[11px] text-slate-400">Lucro: {formatBRL(ord.net_profit)}</p>
                    </div>
                  </div>
                  <div className="text-xs text-slate-300 bg-[#090d16] p-2.5 rounded-xl border border-slate-800/80">
                    {(ord.items || []).map((i, idx) => (
                      <div key={idx} className="flex justify-between py-0.5">
                        <span>{i.qty}x {i.name}</span>
                        <span>{formatBRL(i.price * i.qty)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className={`text-xs font-semibold ${
                      ord.status === 'paid' ? 'text-emerald-400' : ord.status === 'pending' ? 'text-amber-400' : 'text-rose-400'
                    }`}>
                      Status: {ord.status === 'paid' ? 'Pago' : ord.status === 'pending' ? 'Aguardando Pagamento' : 'Cancelado'}
                    </span>
                    <div className="flex gap-2">
                      {ord.status === 'pending' && (
                        <button
                          onClick={() => handleOrderStatus(ord, 'paid')}
                          className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-3 py-1.5 rounded-lg text-xs font-semibold"
                        >
                          Marcar Pago
                        </button>
                      )}
                      {ord.status !== 'cancelled' && (
                        <button
                          onClick={() => handleOrderStatus(ord, 'cancelled')}
                          className="bg-rose-500/15 text-rose-400 px-3 py-1.5 rounded-lg text-xs"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'products' && (
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold text-lg">Produtos ({products.length})</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => openPurchaseModal()}
                    className="bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/40 font-bold text-xs px-3.5 py-2 rounded-xl"
                  >
                    + Registrar Compra
                  </button>
                  <button
                    onClick={() => { setEditingProduct(null); setShowProductModal(true); }}
                    className="bg-emerald-500 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl"
                  >
                    + Novo Produto
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {products.map(p => (
                  <div key={p.id} className="bg-[#111827] border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">{p.category}</span>
                      <h3 className="font-bold text-sm mt-1">{p.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Custo: {formatBRL(p.cost_price)} • <strong className="text-emerald-400">Venda: {formatBRL(p.sell_price)}</strong>
                      </p>
                      <p className={`text-xs mt-1 font-medium ${isLowStockProduct(p) ? 'text-rose-400' : 'text-slate-300'}`}>
                        Estoque: {p.stock} unidades {Number(p.min_stock ?? 0) === 0 ? '• sem alerta' : ''}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => openPurchaseModal(p)}
                        title="Repor estoque com data de compra"
                        className="px-2.5 py-1.5 rounded-lg bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 text-[11px] font-semibold"
                      >
                        Repor
                      </button>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => { setEditingProduct(p); setShowProductModal(true); }}
                          title="Editar produto e data da compra"
                          className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id)}
                          title="Excluir produto"
                          className="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm">
                  Compras / Reposições — {formatMonthLabel(selectedMonth)}
                </h3>
                <span className="text-xs font-bold text-sky-400">
                  Total: {formatBRL(stats.spentInPurchases)}
                </span>
              </div>
              {filteredPurchases.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">Nenhuma compra registrada neste período.</p>
              ) : (
                <div className="space-y-2">
                  {filteredPurchases.map(pur => {
                    const isBadDate = getRecordMonthKey(pur, 'purchase_date') === 'invalid-date';
                    return (
                      <div
                        key={pur.id}
                        className={`flex items-center justify-between gap-2 p-3 rounded-xl bg-[#090d16] border text-xs ${
                          isBadDate ? 'border-amber-500/50' : 'border-slate-800/80'
                        }`}
                      >
                        <div>
                          <p className="font-semibold text-white">{resolvePurchaseProductName(pur)}</p>
                          <p className={isBadDate ? 'text-amber-400 font-medium' : 'text-slate-400'}>
                            Data: {formatShortDate(pur.purchase_date)} • {pur.quantity} un. ({formatBRL(pur.unit_cost)}/un.)
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-sky-400 mr-1">{formatBRL(pur.total_cost)}</span>
                          <button
                            onClick={() => openEditPurchaseModal(pur)}
                            title="Editar data, produto ou valor da compra"
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePurchase(pur.id)}
                            title="Excluir compra"
                            className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'customers' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Clientes ({customers.length})</h2>
              <button
                onClick={() => setShowCustomerModal(true)}
                className="bg-emerald-500 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl"
              >
                + Novo Cliente
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {customers.map(c => (
                <div key={c.id} className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
                  <h3 className="font-bold text-sm">{c.name}</h3>
                  <p className="text-xs text-emerald-400 mt-0.5">{c.phone || 'Sem telefone'}</p>
                  {c.notes && <p className="text-xs text-slate-400 mt-1.5">{c.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 md:hidden bg-[#0d1320]/95 backdrop-blur-md border-t border-slate-800 grid grid-cols-4 py-2">
        {[
          { id: 'dashboard', label: 'Início', icon: LayoutDashboard },
          { id: 'orders', label: 'Pedidos', icon: ShoppingCart },
          { id: 'products', label: 'Produtos', icon: Package },
          { id: 'customers', label: 'Clientes', icon: Users }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex flex-col items-center gap-1 py-1 text-[11px] font-medium ${
              tab === item.id ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </button>
        ))}
      </nav>

      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-base">Configurações</h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {/* Tópico 1: Minha Conta */}
              <div className="bg-[#090d16] border border-slate-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSettingsSection(settingsSection === 'account' ? '' : 'account')}
                  className="w-full flex items-center justify-between p-3.5 text-left hover:bg-slate-800/40 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-white">Minha Conta</p>
                      <p className="text-[11px] text-slate-400">Nome da loja, dados pessoais e contato</p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      settingsSection === 'account' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {settingsSection === 'account' && (
                  <form onSubmit={handleSaveProfile} className="p-3.5 pt-2 border-t border-slate-800/80 space-y-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Nome da Loja / Marca (aparece no topo)</label>
                      <input
                        value={profileForm.store_name}
                        onChange={e => setProfileForm({ ...profileForm, store_name: e.target.value })}
                        maxLength={40}
                        placeholder="Ex: RC Imports Floripa"
                        className="w-full bg-[#111827] border border-slate-700 focus:border-emerald-500 outline-none rounded-xl px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Seu Nome Completo</label>
                      <input
                        value={profileForm.full_name}
                        onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })}
                        placeholder="Ex: Raphael Cordoni Junior"
                        className="w-full bg-[#111827] border border-slate-700 focus:border-emerald-500 outline-none rounded-xl px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">WhatsApp / Celular</label>
                        <input
                          value={profileForm.phone}
                          onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                          placeholder="(48) 99999-9999"
                          className="w-full bg-[#111827] border border-slate-700 focus:border-emerald-500 outline-none rounded-xl px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Cidade / UF</label>
                        <input
                          value={profileForm.city}
                          onChange={e => setProfileForm({ ...profileForm, city: e.target.value })}
                          placeholder="Florianópolis - SC"
                          className="w-full bg-[#111827] border border-slate-700 focus:border-emerald-500 outline-none rounded-xl px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">E-mail de Acesso</label>
                      <input
                        value={session.user.email}
                        disabled
                        className="w-full bg-[#111827]/60 border border-slate-800 text-slate-400 rounded-xl px-3 py-2 text-xs cursor-not-allowed"
                      />
                    </div>

                    {profileSavedMsg && (
                      <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 rounded-lg">
                        {profileSavedMsg}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition"
                    >
                      {savingProfile ? 'Salvando...' : 'Salvar Dados da Conta'}
                    </button>
                  </form>
                )}
              </div>

              {/* Tópico 2: Meu Plano */}
              <div className="bg-[#090d16] border border-slate-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSettingsSection(settingsSection === 'plan' ? '' : 'plan')}
                  className="w-full flex items-center justify-between p-3.5 text-left hover:bg-slate-800/40 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/15 text-violet-400 flex items-center justify-center">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-white">Meu Plano</p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                          Gratuito
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">Assinatura e recursos da conta</p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      settingsSection === 'plan' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {settingsSection === 'plan' && (
                  <div className="p-3.5 pt-2.5 border-t border-slate-800/80 space-y-2.5 text-xs">
                    <div className="bg-[#111827] border border-slate-800 rounded-xl p-3 space-y-1">
                      <p className="font-bold text-white">Plano Atual: Acesso Completo (Beta)</p>
                      <p className="text-slate-400">
                        Produtos, controle de estoque, compras mensais e catálogo online liberados.
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Em breve: gestão de assinatura e upgrade para planos Pro diretamente por aqui.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowSettingsModal(false);
                  supabase.auth.signOut();
                }}
                className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair da Conta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-md p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h3>
              <button onClick={() => setShowProductModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form key={editingProduct?.id || 'new-product'} onSubmit={handleSaveProduct} className="space-y-3">
              <input name="name" required defaultValue={editingProduct?.name} placeholder="Nome do produto" className="w-full bg-[#090d16] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm" />
              <input name="category" defaultValue={editingProduct?.category || 'Geral'} placeholder="Categoria" className="w-full bg-[#090d16] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm" />
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] text-slate-400">Preço de Custo (R$)</label>
                  <input name="cost_price" type="number" step="0.01" defaultValue={editingProduct?.cost_price ?? 0} className="w-full bg-[#090d16] border border-slate-700 rounded-xl px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Preço de Venda (R$)</label>
                  <input name="sell_price" type="number" step="0.01" required defaultValue={editingProduct?.sell_price} className="w-full bg-[#090d16] border border-slate-700 rounded-xl px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] text-slate-400">Estoque Atual</label>
                  <input name="stock" type="number" min="0" required defaultValue={editingProduct?.stock ?? 1} className="w-full bg-[#090d16] border border-slate-700 rounded-xl px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Alerta Mínimo (0 = sem alerta)</label>
                  <input name="min_stock" type="number" min="0" defaultValue={editingProduct?.min_stock ?? 3} className="w-full bg-[#090d16] border border-slate-700 rounded-xl px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Data da Compra (para gasto mensal)</label>
                <input
                  name="purchase_date"
                  type="date"
                  min="2000-01-01"
                  max="2099-12-31"
                  defaultValue={
                    editingProduct
                      ? normalizeDateInput(editingProductLinkedPurchase?.purchase_date || editingProduct.created_at)
                      : getTodayISO()
                  }
                  className="w-full bg-[#090d16] border border-slate-700 rounded-xl px-3 py-2 text-sm [color-scheme:dark]"
                />
              </div>
              <button type="submit" className="w-full bg-emerald-500 text-slate-950 font-bold py-3 rounded-xl text-sm">
                Salvar Produto
              </button>
            </form>
          </div>
        </div>
      )}

      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-md p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base">
                {editingPurchase ? 'Editar Compra / Data' : 'Registrar Compra / Repor Estoque'}
              </h3>
              <button onClick={() => { setShowPurchaseModal(false); setEditingPurchase(null); }}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSavePurchase} className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400">Produto</label>
                <select
                  value={purchaseForm.product_id}
                  onChange={e => {
                    const p = products.find(pr => pr.id === e.target.value);
                    const qty = Number(purchaseForm.quantity) || 1;
                    setPurchaseForm(prev => ({
                      ...prev,
                      product_id: e.target.value,
                      product_name: p ? p.name : prev.product_name,
                      total_cost: !editingPurchase && p
                        ? String(Number((Number(p.cost_price || 0) * qty).toFixed(2)))
                        : prev.total_cost
                    }));
                  }}
                  className="w-full bg-[#090d16] border border-slate-700 rounded-xl px-3 py-2.5 text-sm"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Atual: {p.stock} un.)</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] text-slate-400">Quantidade Comprada</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={purchaseForm.quantity}
                    onChange={e => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })}
                    className="w-full bg-[#090d16] border border-slate-700 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Valor Total Pago (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={purchaseForm.total_cost}
                    onChange={e => setPurchaseForm({ ...purchaseForm, total_cost: e.target.value })}
                    className="w-full bg-[#090d16] border border-slate-700 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Data da Compra</label>
                <input
                  type="date"
                  min="2000-01-01"
                  max="2099-12-31"
                  required
                  value={purchaseForm.purchase_date}
                  onChange={e => setPurchaseForm({ ...purchaseForm, purchase_date: e.target.value })}
                  className="w-full bg-[#090d16] border border-slate-700 rounded-xl px-3 py-2 text-sm [color-scheme:dark]"
                />
              </div>
              <button type="submit" className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold py-3 rounded-xl text-sm">
                {editingPurchase ? 'Salvar Alterações da Compra' : 'Salvar Compra e Atualizar Estoque'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showSaleModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base">Registrar Nova Venda</h3>
              <button onClick={() => setShowSaleModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateSale} className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400">Adicionar Produto</label>
                <select
                  onChange={e => { if (e.target.value) { addSaleItem(e.target.value); e.target.value = ''; } }}
                  className="w-full bg-[#090d16] border border-slate-700 rounded-xl px-3 py-2.5 text-sm"
                >
                  <option value="">Selecione um produto...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {formatBRL(p.sell_price)} ({p.stock} un.)</option>
                  ))}
                </select>
              </div>

              {saleItems.length > 0 && (
                <div className="bg-[#090d16] border border-slate-800 rounded-xl p-2.5 space-y-1.5">
                  {saleItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between text-xs">
                      <span>{item.qty}x {item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-semibold">{formatBRL(item.price * item.qty)}</span>
                        <button type="button" onClick={() => setSaleItems(prev => prev.filter(i => i.id !== item.id))} className="text-rose-400">x</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="text-[11px] text-slate-400">Data da Venda</label>
                <input
                  type="date"
                  min="2000-01-01"
                  max="2099-12-31"
                  required
                  value={saleMeta.sale_date}
                  onChange={e => setSaleMeta({ ...saleMeta, sale_date: e.target.value })}
                  className="w-full bg-[#090d16] border border-slate-700 rounded-xl px-3.5 py-2 text-sm [color-scheme:dark]"
                />
              </div>

              <input
                placeholder="Nome do cliente (ou Cliente Balcão)"
                value={saleMeta.customer_name}
                onChange={e => setSaleMeta({ ...saleMeta, customer_name: e.target.value })}
                className="w-full bg-[#090d16] border border-slate-700 rounded-xl px-3.5 py-2 text-sm"
              />

              <div className="grid grid-cols-2 gap-2">
                <select value={saleMeta.channel} onChange={e => setSaleMeta({ ...saleMeta, channel: e.target.value })} className="bg-[#090d16] border border-slate-700 rounded-xl px-3 py-2 text-sm">
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Loja Física">Loja Física</option>
                </select>
                <select value={saleMeta.payment_method} onChange={e => setSaleMeta({ ...saleMeta, payment_method: e.target.value })} className="bg-[#090d16] border border-slate-700 rounded-xl px-3 py-2 text-sm">
                  <option value="Pix">Pix</option>
                  <option value="Cartão Crédito">Cartão Crédito</option>
                  <option value="Cartão Débito">Cartão Débito</option>
                  <option value="Dinheiro">Dinheiro</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400">Taxa Maquininha %</label>
                  <input type="number" step="0.1" value={saleMeta.card_fee_percent} onChange={e => setSaleMeta({ ...saleMeta, card_fee_percent: e.target.value })} className="w-full bg-[#090d16] border border-slate-700 rounded-xl px-2.5 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Desconto (R$)</label>
                  <input type="number" step="0.01" value={saleMeta.discount} onChange={e => setSaleMeta({ ...saleMeta, discount: e.target.value })} className="w-full bg-[#090d16] border border-slate-700 rounded-xl px-2.5 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Status</label>
                  <select value={saleMeta.status} onChange={e => setSaleMeta({ ...saleMeta, status: e.target.value })} className="w-full bg-[#090d16] border border-slate-700 rounded-xl px-2 py-2 text-sm">
                    <option value="paid">Pago</option>
                    <option value="pending">Pendente</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="w-full bg-emerald-500 text-slate-950 font-bold py-3 rounded-xl text-sm">
                Concluir Venda
              </button>
            </form>
          </div>
        </div>
      )}

      {showCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-md p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base">Novo Cliente</h3>
              <button onClick={() => setShowCustomerModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSaveCustomer} className="space-y-3">
              <input name="name" required placeholder="Nome completo" className="w-full bg-[#090d16] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm" />
              <input name="phone" placeholder="WhatsApp / Telefone" className="w-full bg-[#090d16] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm" />
              <textarea name="notes" placeholder="Observações" className="w-full bg-[#090d16] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm" />
              <button type="submit" className="w-full bg-emerald-500 text-slate-950 font-bold py-3 rounded-xl text-sm">
                Salvar Cliente
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

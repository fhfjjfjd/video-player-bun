import './tailwind.css';
import './antidev';
import { api } from './api';
import { msgError, msgSuccess } from './ui';

let mode: 'login' | 'register' = 'login';
const message = document.getElementById('message')!;
const toggle = document.getElementById('toggle')!;
const title = document.getElementById('auth-title')!;
const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;

toggle.addEventListener('click', e => {
  e.preventDefault();
  mode = mode === 'login' ? 'register' : 'login';
  title.textContent = mode === 'login' ? 'Đăng nhập' : 'Đăng ký';
  submitBtn.textContent = mode === 'login' ? 'Đăng nhập' : 'Đăng ký';
  toggle.textContent = mode === 'login' ? 'Đăng ký' : 'Đăng nhập';
  toggle.parentElement!.firstChild!.textContent = mode === 'login' ? ' Chưa có tài khoản? ' : ' Đã có tài khoản? ';
});

function showMessage(type: 'error' | 'success', text: string) {
  message.className = type === 'error' ? msgError : msgSuccess;
  message.textContent = text;
}

submitBtn.addEventListener('click', async () => {
  const username = (document.getElementById('username') as HTMLInputElement).value.trim();
  const password = (document.getElementById('password') as HTMLInputElement).value;
  if (!username || !password) return showMessage('error', 'Vui lòng nhập đầy đủ thông tin');
  try {
    if (mode === 'register') {
      await api.post('/api/register', { username, password });
      showMessage('success', 'Đăng ký thành công! Chuyển sang đăng nhập...');
      mode = 'login';
      title.textContent = 'Đăng nhập';
      submitBtn.textContent = 'Đăng nhập';
      toggle.textContent = 'Đăng ký';
      toggle.parentElement!.firstChild!.textContent = ' Chưa có tài khoản? ';
    } else {
      await api.post('/api/login', { username, password });
      location.href = '/index.html';
    }
  } catch (e: any) {
    showMessage('error', e.message);
  }
});

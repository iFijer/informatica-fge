/* ==========================================================================
   CONTROLADOR DEL SITIO INDEX (INICIO DE SESIÓN Y RESTABLECIMIENTO)
   ========================================================================== */

(function () {
    async function bootstrapLogin() {
        const { user } = await window.FGEDB.init();
        window.FGEUI.updateConnectionBadge('connectionStatusPill');

        // Verificar si llegó un enlace de restablecimiento de contraseña (?resetToken=...)
        const params = new URLSearchParams(window.location.search);
        const resetToken = params.get('resetToken');
        if (resetToken) {
            const targetUser = await window.FGEDB.validateResetToken(resetToken);
            if (targetUser) {
                showResetPasswordMode(targetUser, resetToken);
                return;
            } else {
                window.FGEUI.showToast('El enlace de restablecimiento expiró o ya fue utilizado.', 'warning');
            }
        }

        // Mostrar acceso rápido si ya existe sesión iniciada
        if (user) {
            const banner = document.getElementById('activeSessionBanner');
            document.getElementById('activeSessionName').textContent = user.fullName || user.username;
            document.getElementById('activeSessionRole').textContent = user.role === 'admin' ? 'Administrador' : 'Perito / Usuario';
            const continueBtn = document.getElementById('continueSessionBtn');
            continueBtn.href = user.role === 'admin' ? 'admin.html' : 'dashboard.html';
            continueBtn.textContent = user.role === 'admin' ? 'Ir al Panel Admin' : 'Ir al Dashboard';

            if (user.role === 'admin') {
                const quickDash = document.getElementById('goAdminQuickBtn');
                quickDash.href = 'dashboard.html';
                quickDash.textContent = 'Ir al Dashboard';
                quickDash.classList.remove('hidden');
            }
            banner.classList.remove('hidden');
        }

        bindEvents();
    }

    function showResetPasswordMode(targetUser, token) {
        document.getElementById('loginCard').classList.add('hidden');
        const resetCard = document.getElementById('resetPasswordCard');
        resetCard.classList.remove('hidden');
        document.getElementById('resetTargetInfo').textContent =
            `Usuario: ${targetUser.fullName} (${targetUser.username}) — ${targetUser.email}`;

        const form = document.getElementById('resetPasswordForm');
        const errBox = document.getElementById('resetErrorBox');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errBox.classList.add('hidden');
            const p1 = document.getElementById('resetNewPwd').value;
            const p2 = document.getElementById('resetConfirmPwd').value;
            if (p1 !== p2) {
                errBox.textContent = 'Las contraseñas no coinciden.';
                errBox.classList.remove('hidden');
                return;
            }
            try {
                await window.FGEDB.completeLocalPasswordReset(token, p1);
                window.FGEUI.showToast('Contraseña actualizada correctamente. Ya puedes iniciar sesión.', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1300);
            } catch (err) {
                errBox.textContent = err.message || 'No se pudo actualizar la contraseña.';
                errBox.classList.remove('hidden');
            }
        });
    }

    function bindEvents() {
        const loginForm = document.getElementById('loginForm');
        const pwdInput = document.getElementById('loginPassword');
        const togglePwdBtn = document.getElementById('togglePwdBtn');
        const errorBox = document.getElementById('loginErrorBox');
        const submitBtn = document.getElementById('loginSubmitBtn');

        togglePwdBtn.addEventListener('click', () => {
            pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
        });

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorBox.classList.add('hidden');
            const username = document.getElementById('loginUsername').value.trim();
            const password = pwdInput.value;

            submitBtn.disabled = true;
            try {
                const loggedUser = await window.FGEDB.login(username, password);
                window.FGEUI.showToast(`Bienvenido, ${loggedUser.fullName}`, 'success');
                setTimeout(() => {
                    window.location.href = loggedUser.role === 'admin' ? 'admin.html' : 'dashboard.html';
                }, 450);
            } catch (err) {
                errorBox.textContent = err.message || 'No se pudo iniciar sesión.';
                errorBox.classList.remove('hidden');
                submitBtn.disabled = false;
            }
        });

        const logoutQuickBtn = document.getElementById('logoutQuickBtn');
        if (logoutQuickBtn) {
            logoutQuickBtn.addEventListener('click', async () => {
                await window.FGEDB.logout();
                document.getElementById('activeSessionBanner').classList.add('hidden');
                window.FGEUI.showToast('Sesión cerrada. Ingresa con otra cuenta.', 'info');
            });
        }

        // Modal de recuperación de contraseña
        document.getElementById('openForgotModalBtn').addEventListener('click', () => {
            document.getElementById('forgotFeedback').classList.add('hidden');
            document.getElementById('forgotIdentifier').value = document.getElementById('loginUsername').value.trim();
            window.FGEUI.openModal('forgotModal');
        });

        document.querySelectorAll('[data-close-modal]').forEach((btn) => {
            btn.addEventListener('click', () => window.FGEUI.closeModal(btn.getAttribute('data-close-modal')));
        });

        document.getElementById('sendForgotBtn').addEventListener('click', async () => {
            const idVal = document.getElementById('forgotIdentifier').value.trim();
            const fb = document.getElementById('forgotFeedback');
            fb.classList.remove('hidden', 'success', 'danger', 'warning');
            try {
                const res = await window.FGEDB.requestPasswordResetSelf(idVal);
                fb.classList.add('success');
                fb.textContent = `Se envió un correo de restablecimiento a ${res.email}. Revisa tu bandeja de entrada o carpeta de spam.`;
            } catch (err) {
                fb.classList.add('warning');
                fb.textContent = err.message;
            }
        });
    }

    window.addEventListener('DOMContentLoaded', bootstrapLogin);
})();

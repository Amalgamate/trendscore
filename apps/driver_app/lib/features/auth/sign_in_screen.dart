import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/config/app_config.dart';
import '../../core/data/auth_repository.dart';
import '../../core/error/api_exception.dart';
import '../../core/models/school_connection.dart';

/// Driver sign-in.
///
/// Uses the phone number + password the school office issues to drivers. The
/// phone-OTP flow is deliberately not used: it validates the PARENT role.
class SignInScreen extends StatefulWidget {
  const SignInScreen({
    required this.onSignedIn,
    required this.beforeSignIn,
    super.key,
  });

  final VoidCallback onSignedIn;
  final Future<bool> Function() beforeSignIn;

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _passwordFocus = FocusNode();

  bool _obscure = true;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    _password.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final authRepository = context.read<AuthRepository>();
      if (!await widget.beforeSignIn()) {
        if (mounted) {
          setState(
            () => _error = 'Waiting for your school to approve this phone.',
          );
        }
        return;
      }
      await authRepository.signIn(phone: _phone.text, password: _password.text);
      if (!mounted) return;
      widget.onSignedIn();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.code == 'DEVICE_NOT_APPROVED'
            ? 'Waiting for your school to approve this phone.'
            : e.isNetworkError
            ? 'Cannot reach the school server. Check your connection.'
            : e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final config = context.read<AppConfig>();
    final brand = Color(config.primaryColorValue);
    final muted = Colors.black.withValues(alpha: 0.45);
    final logoUrl = context.read<SchoolConnection>().branding.bestLogoUrl;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              // Keeps the form readable on tablets and in landscape.
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        height: 68,
                        width: 68,
                        decoration: BoxDecoration(
                          color: brand,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: logoUrl == null
                            ? const Icon(
                                Icons.directions_bus_rounded,
                                color: Colors.white,
                                size: 34,
                              )
                            : ClipRRect(
                                borderRadius: BorderRadius.circular(20),
                                child: Image.network(
                                  logoUrl,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, _, _) => const Icon(
                                    Icons.directions_bus_rounded,
                                    color: Colors.white,
                                    size: 34,
                                  ),
                                ),
                              ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      config.schoolName,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: brand,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Driver App',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.black54),
                    ),
                    const SizedBox(height: 32),
                    _buildPhoneField(),
                    const SizedBox(height: 14),
                    _buildPasswordField(),
                    if (_error != null) ...[
                      const SizedBox(height: 16),
                      _ErrorBanner(message: _error!),
                    ],
                    const SizedBox(height: 24),
                    _buildSubmit(brand),
                    const SizedBox(height: 8),
                    const SizedBox(height: 20),
                    Text(
                      'Having trouble signing in? Contact the school office.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, color: muted),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      config.displayVersion,
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 11, color: muted),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPhoneField() {
    return TextFormField(
      controller: _phone,
      keyboardType: TextInputType.phone,
      textInputAction: TextInputAction.next,
      autocorrect: false,
      decoration: const InputDecoration(
        labelText: 'Phone number',
        prefixIcon: Icon(Icons.phone_outlined),
      ),
      validator: (v) {
        final value = (v ?? '').trim();
        if (value.isEmpty) return 'Enter your phone number';
        if (value.replaceAll(RegExp(r'\D'), '').length < 9) {
          return 'Enter a valid phone number';
        }
        return null;
      },
      onFieldSubmitted: (_) => _passwordFocus.requestFocus(),
    );
  }

  Widget _buildPasswordField() {
    return TextFormField(
      controller: _password,
      focusNode: _passwordFocus,
      obscureText: _obscure,
      textInputAction: TextInputAction.done,
      decoration: InputDecoration(
        labelText: 'Password',
        prefixIcon: const Icon(Icons.lock_outline),
        suffixIcon: IconButton(
          onPressed: () => setState(() => _obscure = !_obscure),
          icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility),
          tooltip: _obscure ? 'Show password' : 'Hide password',
        ),
      ),
      validator: (v) => (v ?? '').isEmpty ? 'Enter your password' : null,
      onFieldSubmitted: (_) => _submit(),
    );
  }

  Widget _buildSubmit(Color brand) {
    return FilledButton(
      onPressed: _busy ? null : _submit,
      style: FilledButton.styleFrom(backgroundColor: brand),
      child: _busy
          ? const SizedBox(
              height: 22,
              width: 22,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                color: Colors.white,
              ),
            )
          : const Text('Sign In'),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFEE4E2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFCA5A5)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_outline, size: 18, color: Color(0xFFB91C1C)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

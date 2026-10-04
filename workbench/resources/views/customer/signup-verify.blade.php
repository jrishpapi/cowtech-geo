<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $pageTitle ?? __('customer.verify_page') }}</title>
    <link rel="stylesheet" href="{{ asset('css/tailwind.css') }}?v={{ filemtime(public_path('css/tailwind.css')) }}">
    <script src="{{ asset('js/lucide.min.js') }}"></script>
</head>
<body class="min-h-screen bg-[#f3f4ef] text-[#17201b] antialiased">
    <main class="mx-auto flex min-h-screen max-w-5xl items-center px-4 py-10 sm:px-6">
        <div class="grid w-full overflow-hidden rounded-2xl border border-[#d5ddd6] bg-white shadow-[0_24px_70px_rgba(23,32,27,0.10)] lg:grid-cols-[0.92fr_1.08fr]">
            <section class="relative overflow-hidden bg-[#17201b] px-7 py-10 text-white sm:px-10 lg:py-14">
                <div class="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10"></div>
                <div class="absolute -bottom-36 -left-24 h-80 w-80 rounded-full bg-[#0f766e]/30 blur-3xl"></div>
                <div class="relative">
                    <div class="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10">
                        <i data-lucide="shield-check" class="h-5 w-5" aria-hidden="true"></i>
                    </div>
                    <p class="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[#8ed7cf]">Secure entitlement claim</p>
                    <h1 class="mt-4 max-w-md text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">
                        {{ __('customer.verify_title') }}
                    </h1>
                    <p class="mt-5 max-w-md text-sm leading-7 text-[#c8d2cc]">
                        {{ __('customer.verify_intro') }}
                    </p>

                    <dl class="mt-10 grid gap-5 border-t border-white/10 pt-7 text-sm">
                        <div>
                            <dt class="text-xs uppercase tracking-[0.16em] text-[#91a099]">{{ __('customer.sent_to') }}</dt>
                            <dd class="mt-2 font-medium text-white">{{ $maskedEmail }}</dd>
                        </div>
                        @if ($expiresAt)
                            <div>
                                <dt class="text-xs uppercase tracking-[0.16em] text-[#91a099]">{{ __('customer.code_expires') }}</dt>
                                <dd class="mt-2 font-medium text-white">
                                    <time datetime="{{ $expiresAt->toIso8601String() }}">{{ $expiresAt->timezone('Asia/Shanghai')->format('Y-m-d H:i') }}</time>
                                </dd>
                            </div>
                        @endif
                    </dl>
                </div>
            </section>

            <section class="px-7 py-10 sm:px-10 lg:px-12 lg:py-14">
                <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#0f766e]">Email verification</p>
                <h2 class="mt-3 text-2xl font-semibold tracking-[-0.02em]">{{ __('customer.enter_code') }}</h2>
                <p class="mt-3 text-sm leading-6 text-[#667169]">
                    {{ __('customer.code_help_spam') }}
                </p>

                @if (session('message'))
                    <div role="status" class="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        {{ session('message') }}
                    </div>
                @endif

                @if ($errors->any())
                    <div role="alert" class="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {{ $errors->first() }}
                    </div>
                @endif

                <form method="POST" action="{{ route('customer.signup.verify.store') }}" class="mt-7">
                    @csrf
                    <label for="code" class="block text-sm font-semibold">{{ __('customer.verification_code') }}</label>
                    <input
                        id="code"
                        name="code"
                        type="text"
                        value="{{ old('code') }}"
                        required
                        autofocus
                        inputmode="numeric"
                        autocomplete="one-time-code"
                        pattern="[0-9]{6}"
                        minlength="6"
                        maxlength="6"
                        aria-describedby="code-help"
                        class="mt-3 block w-full rounded-xl border-[#bcc8bf] bg-[#fbfcf9] px-4 py-4 text-center font-mono text-3xl font-semibold tracking-[0.38em] shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]"
                        placeholder="000000"
                    >
                    <p id="code-help" class="mt-3 text-xs leading-5 text-[#748078]">{{ __('customer.code_single_use') }}</p>

                    <button type="submit" class="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#17201b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#29362f] focus:outline-none focus:ring-2 focus:ring-[#0f766e] focus:ring-offset-2">
                        {{ __('customer.verify_bind') }}
                        <i data-lucide="arrow-right" class="h-4 w-4" aria-hidden="true"></i>
                    </button>
                </form>

                <div class="mt-7 border-t border-[#e0e6e1] pt-6">
                    <form method="POST" action="{{ route('customer.signup.verify.resend') }}">
                        @csrf
                        <button type="submit" class="inline-flex items-center gap-2 text-sm font-semibold text-[#0f766e] underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[#0f766e] focus:ring-offset-2">
                            <i data-lucide="mail-plus" class="h-4 w-4" aria-hidden="true"></i>
                            {{ __('customer.resend_code') }}
                        </button>
                    </form>
                    @if ($canResendAt)
                        <p class="mt-2 text-xs leading-5 text-[#748078]">
                            {{ __('customer.resend_limit_note') }}
                            <time datetime="{{ $canResendAt->toIso8601String() }}">{{ $canResendAt->timezone('Asia/Shanghai')->format('H:i') }}</time>
                        </p>
                    @endif
                </div>
            </section>
        </div>
    </main>

    <script>
        document.addEventListener('DOMContentLoaded', function () {
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });
    </script>
</body>
</html>

{{-- Modified for CowTech GEO: replace browser compiler with production CSS. Upstream attribution retained. --}}

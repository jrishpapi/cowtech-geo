@php($selfHosted = config('services.cowtech.deployment_mode') === 'self_hosted')
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $pageTitle ?? __('customer.signup_page') }}</title>
    <link rel="stylesheet" href="{{ asset('css/tailwind.css') }}?v={{ filemtime(public_path('css/tailwind.css')) }}">
    <script src="{{ asset('js/lucide.min.js') }}"></script>
</head>
<body class="min-h-screen bg-[#f5f6f1] text-[#17201b]">
    <a href="#main-content" class="sr-only fixed left-4 top-4 z-[1400] rounded-md bg-white px-4 py-3 font-semibold text-[#17201b] shadow-lg focus:not-sr-only">{{ __('customer.skip_to_content') }}</a>
    <main id="main-content" tabindex="-1" class="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-4 py-10 lg:grid-cols-[0.9fr_1.1fr]">
        <section>
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f766e]">{{ $selfHosted ? 'Self-hosted workspace' : 'Payment to fulfillment' }}</p>
            <h1 class="mt-4 text-4xl font-semibold tracking-normal">{{ $selfHosted ? 'Create your local account' : __('customer.signup_title') }}</h1>
            <p class="mt-4 max-w-xl text-sm leading-6 text-[#58645d]">
                {{ $selfHosted ? 'Use your own AI services. Verify your email to get started; no CowTech subscription is required.' : __('customer.signup_intro') }}
            </p>
            <div class="mt-8 grid gap-3 text-sm text-[#2f3b34]">
                @foreach (($selfHosted ? ['Create account', 'Verify email', 'Configure your services', 'Start your project'] : [__('customer.signup_step_1'), __('customer.signup_step_2'), __('customer.signup_step_3'), __('customer.signup_step_4')]) as $step)
                    <div class="flex items-center gap-3">
                        <span class="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white text-xs font-semibold shadow-sm">{{ $loop->iteration }}</span>
                        <span>{{ $step }}</span>
                    </div>
                @endforeach
            </div>
        </section>

        <section class="rounded-lg border border-[#d8dfd9] bg-white p-6 shadow-sm sm:p-8">
            @if ($errors->any())
                <div class="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {{ $errors->first() }}
                </div>
            @endif

            <form method="POST" action="{{ route('customer.signup.store') }}" class="grid gap-5">
                @csrf
                <input type="hidden" name="source" value="{{ old('source', $prefill['source'] ?? '') }}">
                <input type="hidden" name="order_id" value="{{ old('order_id', $prefill['order_id'] ?? '') }}">

                <div>
                    <label for="email" class="block text-sm font-semibold">{{ $selfHosted ? 'Email' : __('customer.payment_email') }} *</label>
                    <input id="email" name="email" type="email" autocomplete="email" required value="{{ old('email', $prefill['email'] ?? '') }}" class="mt-2 block w-full rounded-md border-[#c7d0c8] shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" placeholder="you@example.com">
                </div>
                <div class="grid gap-5 sm:grid-cols-2">
                    <div>
                        <label for="password" class="block text-sm font-semibold">{{ __('customer.set_password') }} *</label>
                        <input id="password" name="password" type="password" required minlength="8" class="mt-2 block w-full rounded-md border-[#c7d0c8] shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" autocomplete="new-password">
                    </div>
                    <div>
                        <label for="password_confirmation" class="block text-sm font-semibold">{{ __('customer.confirm_password') }} *</label>
                        <input id="password_confirmation" name="password_confirmation" type="password" required minlength="8" class="mt-2 block w-full rounded-md border-[#c7d0c8] shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" autocomplete="new-password">
                    </div>
                </div>
                <div>
                    <label for="brand_name" class="block text-sm font-semibold">{{ __('customer.brand_name') }}</label>
                    <input id="brand_name" name="brand_name" autocomplete="organization" value="{{ old('brand_name', $prefill['brand_name'] ?? '') }}" class="mt-2 block w-full rounded-md border-[#c7d0c8] shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" placeholder="{{ __('customer.brand_placeholder') }}">
                </div>
                <div>
                    <label for="brand_url" class="block text-sm font-semibold">{{ __('customer.brand_website') }}</label>
                    <input id="brand_url" name="brand_url" type="url" autocomplete="url" value="{{ old('brand_url', $prefill['brand_url'] ?? '') }}" class="mt-2 block w-full rounded-md border-[#c7d0c8] shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" placeholder="https://example.com">
                </div>
                <div>
                    <label for="business_summary" class="block text-sm font-semibold">{{ __('customer.business_summary') }}</label>
                    <input id="business_summary" name="business_summary" maxlength="500" value="{{ old('business_summary', $prefill['business_summary'] ?? '') }}" class="mt-2 block w-full rounded-md border-[#c7d0c8] shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" placeholder="{{ __('customer.business_placeholder') }}">
                </div>
                <div class="flex flex-col gap-3 border-t border-[#d8dfd9] pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <a href="{{ $loginUrl }}" class="text-sm font-medium text-[#0f766e] hover:text-[#0b5f59]">{{ __('customer.existing_account') }}</a>
                    <button type="submit" class="inline-flex items-center justify-center gap-2 rounded-md bg-[#17201b] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#2f3b34]">
                        <i data-lucide="arrow-right" class="h-4 w-4"></i>
                        {{ __('customer.create_continue') }}
                    </button>
                </div>
            </form>
        </section>
    </main>
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });
    </script>
</body>
</html>

{{-- Modified for CowTech GEO: replace browser compiler with production CSS. Upstream attribution retained. --}}

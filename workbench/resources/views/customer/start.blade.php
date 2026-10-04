@extends('customer.layouts.app')

@section('content')
@php
    $gate = $entitlementGate ?? [
        'can_start_aivgl' => true,
        'can_generate_launch_pack' => true,
        'plan_code' => 'starter',
        'billing_status' => 'active',
        'state' => 'subscription_active',
        'message' => '',
    ];
    $selfHosted = ($gate['access_source'] ?? '') === 'self_hosted';
    $canStartAivgl = (bool) ($gate['can_start_aivgl'] ?? false);
    $canGenerateLaunchPack = (bool) ($gate['can_generate_launch_pack'] ?? false);
    $launchOnly = $canGenerateLaunchPack && ! $canStartAivgl;
    $planLabel = $selfHosted ? 'Self-hosted' : match (strtolower((string) ($gate['plan_code'] ?? ''))) {
        'launch' => __('customer.launch_pack_name'),
        'starter' => 'Starter',
        'pro' => 'Pro',
        'god', 'god_mode' => 'God',
        default => __('customer.plan_not_bound'),
    };
    $accountStatusLabel = match (strtolower((string) ($gate['billing_status'] ?? ''))) {
        'active' => __('customer.status_active'),
        'paid' => __('customer.status_paid'),
        'trial' => __('customer.status_trial'),
        'past_due' => __('customer.status_past_due'),
        'paused' => __('customer.status_paused'),
        'cancelled', 'canceled' => __('customer.status_cancelled'),
        default => __('customer.status_missing'),
    };
@endphp
<div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#64716a]">{{ __('customer.onboarding_label') }}</p>
        <h1 class="mt-2 text-3xl font-semibold tracking-[-0.025em] text-[#17201b] sm:text-4xl">
            {{ __('customer.onboarding_title') }}
        </h1>
    </div>
    <p class="max-w-xl text-sm leading-6 text-[#64716a]">{{ __('customer.onboarding_detail') }}</p>
</div>
<section class="customer-panel overflow-hidden">
    @if (! $canStartAivgl && ! $canGenerateLaunchPack)
        <div class="grid gap-px bg-[#d8dfd9] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div class="bg-[#17201b] p-6 text-white sm:p-8">
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#9bd8c9]">{{ __('customer.payment_status') }}</p>
                <h2 class="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">{{ $selfHosted ? 'Verify your local account' : __('customer.waiting_payment_binding') }}</h2>
                <p class="mt-4 max-w-xl text-sm leading-6 text-[#dbe7dd]">
                    {{ $gate['message'] ?? __('customer.no_payment_record') }}
                </p>
            </div>
            <div class="bg-white p-6 sm:p-8">
                <div class="rounded-md border border-[#d8dfd9] bg-[#f7faf7] p-5">
                    <p class="text-sm font-semibold text-[#17201b]">{{ __('customer.cannot_start') }}</p>
                    <dl class="mt-4 grid gap-3 text-sm text-[#4f5f55] sm:grid-cols-2">
                        <div>
                            <dt class="text-xs uppercase tracking-[0.14em] text-[#7b8a81]">{{ __('customer.plan_label') }}</dt>
                            <dd class="mt-1 font-semibold text-[#17201b]">{{ $planLabel }}</dd>
                        </div>
                        <div>
                            <dt class="text-xs uppercase tracking-[0.14em] text-[#7b8a81]">{{ __('customer.account_status') }}</dt>
                            <dd class="mt-1 font-semibold text-[#17201b]">{{ $accountStatusLabel }}</dd>
                        </div>
                    </dl>
                    <p class="mt-5 text-xs leading-5 text-[#64716a]">{{ $selfHosted ? ($gate['message'] ?? '') : __('customer.no_entitlement_detail') }}</p>
                </div>
            </div>
        </div>
    @else
    <div class="grid gap-px bg-[#d8dfd9] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div class="bg-[#17201b] p-6 text-white sm:p-8">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#9bd8c9]">{{ $launchOnly ? __('customer.launch_pack_name') : __('customer.first_use') }}</p>
            <h2 class="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">{{ $launchOnly ? __('customer.launch_heading') : __('customer.monitoring_heading') }}</h2>
            <p class="mt-4 max-w-xl text-sm leading-6 text-[#dbe7dd]">
                @if ($launchOnly)
                    {{ __('customer.launch_intro') }}
                @else
                    {{ __('customer.monitoring_intro') }}
                @endif
            </p>
            <div class="mt-8 grid gap-3 text-sm">
                @foreach ($launchOnly
                    ? [__('customer.launch_step_1'), __('customer.launch_step_2'), __('customer.launch_step_3'), __('customer.launch_step_4')]
                    : [__('customer.monitoring_step_1'), __('customer.monitoring_step_2'), __('customer.monitoring_step_3'), __('customer.monitoring_step_4')] as $step)
                    <div class="flex items-center gap-3">
                        <span class="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-xs font-semibold">{{ $loop->iteration }}</span>
                        <span>{{ $step }}</span>
                    </div>
                @endforeach
            </div>
        </div>

        <form method="POST" action="{{ route('customer.start.store') }}" class="bg-white p-6 sm:p-8">
            @csrf
            <div class="grid gap-5">
                <div>
                    <label for="brand_name" class="block text-sm font-semibold text-[#17201b]">{{ __('customer.brand_name') }} *</label>
                    <input id="brand_name" name="brand_name" required value="{{ old('brand_name', $workspace->brand_name ?? ($prefill['brand_name'] ?? '')) }}" class="mt-2 block w-full rounded-md border-[#c7d0c8] shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" placeholder="{{ __('customer.brand_placeholder') }}">
                </div>
                <div>
                    <label for="brand_url" class="block text-sm font-semibold text-[#17201b]">{{ __('customer.brand_website') }} *</label>
                    <input id="brand_url" name="brand_url" type="text" inputmode="url" autocomplete="url" autocapitalize="none" spellcheck="false" required value="{{ old('brand_url', $workspace->brand_url ?? ($prefill['brand_url'] ?? '')) }}" class="mt-2 block w-full rounded-md border-[#c7d0c8] shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" placeholder="example.com">
                </div>
                <div>
                    <label for="business_summary" class="block text-sm font-semibold text-[#17201b]">{{ __('customer.business_summary') }}</label>
                    <input id="business_summary" name="business_summary" maxlength="500" value="{{ old('business_summary', $workspace->business_summary ?? ($prefill['business_summary'] ?? '')) }}" class="mt-2 block w-full rounded-md border-[#c7d0c8] shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" placeholder="{{ __('customer.business_placeholder') }}">
                </div>
                <div>
                    <label for="target_market" class="block text-sm font-semibold text-[#17201b]">{{ __('customer.target_market') }}</label>
                    <input id="target_market" name="target_market" maxlength="160" value="{{ old('target_market', $workspace->target_market ?? '') }}" class="mt-2 block w-full rounded-md border-[#c7d0c8] shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" placeholder="{{ __('customer.target_market_placeholder') }}">
                </div>
                <div class="grid gap-5 md:grid-cols-2">
                    <div>
                        <label for="competitors" class="block text-sm font-semibold text-[#17201b]">{{ __('customer.competitors') }}</label>
                        <textarea id="competitors" name="competitors" rows="5" class="mt-2 block w-full rounded-md border-[#c7d0c8] shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" placeholder="{{ __('customer.competitors_placeholder') }}">{{ old('competitors', $workspace->competitors_text ?? '') }}</textarea>
                    </div>
                    <div>
                        <label for="target_prompts" class="block text-sm font-semibold text-[#17201b]">{{ __('customer.target_prompts') }}</label>
                        <textarea id="target_prompts" name="target_prompts" rows="5" class="mt-2 block w-full rounded-md border-[#c7d0c8] shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" placeholder="{{ __('customer.prompts_placeholder') }}">{{ old('target_prompts', $workspace->target_prompts_text ?? '') }}</textarea>
                    </div>
                </div>
                <input type="hidden" name="locale" value="{{ app()->getLocale() }}">
                <input type="hidden" name="source" value="{{ old('source', $prefill['source'] ?? '') }}">
                <input type="hidden" name="order_id" value="{{ old('order_id', $prefill['order_id'] ?? '') }}">
                <div class="flex flex-col gap-3 border-t border-[#d8dfd9] pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p class="text-xs leading-5 text-[#64716a]">
                        @if ($launchOnly)
                            {{ __('customer.launch_submit_note') }}
                        @else
                            {{ __('customer.monitoring_submit_note') }}
                        @endif
                    </p>
                    <button type="submit" class="inline-flex items-center justify-center gap-2 rounded-md bg-[#17201b] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#2f3b34]">
                        <i data-lucide="radar" class="h-4 w-4"></i>
                        {{ $launchOnly ? __('customer.generate_launch_pack') : __('customer.start_first_run') }}
                    </button>
                </div>
            </div>
        </form>
    </div>
    @endif
</section>
@endsection

@push('scripts')
<script>
    (() => {
        const website = document.getElementById('brand_url');
        if (!website) return;

        const normalizeWebsite = () => {
            const value = website.value.trim();
            if (value === '' || /^https?:\/\//i.test(value)) return;
            website.value = value.startsWith('//') ? `https:${value}` : `https://${value}`;
        };

        website.addEventListener('blur', normalizeWebsite);
        website.form?.addEventListener('submit', normalizeWebsite);
    })();
</script>
@endpush

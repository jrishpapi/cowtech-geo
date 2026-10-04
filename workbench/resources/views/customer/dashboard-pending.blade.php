@extends('customer.layouts.app')

@section('content')
<section class="customer-panel p-6 sm:p-8">
    <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f766e]">{{ __('customer.pending_kicker') }}</p>
            <h1 class="mt-3 text-3xl font-semibold tracking-normal text-[#17201b] sm:text-4xl">{{ __('customer.pending_heading', ['brand' => $workspace->brand_name]) }}</h1>
            <p class="mt-4 max-w-3xl text-sm leading-6 text-[#64716a]">
                {{ __('customer.pending_intro') }}
            </p>
        </div>
        <a href="{{ route('customer.start') }}" class="inline-flex items-center justify-center gap-2 rounded-md border border-[#d8dfd9] bg-white px-4 py-2.5 text-sm font-semibold text-[#385642] hover:bg-[#f3f7f1]">
            <i data-lucide="pencil" class="h-4 w-4"></i>
            {{ __('customer.edit_brand') }}
        </a>
    </div>

    <div class="mt-8 grid gap-4 md:grid-cols-3">
        <div class="rounded-lg border border-[#d8dfd9] bg-white p-5">
            <div class="text-sm font-semibold text-[#64716a]">{{ __('customer.brand_website') }}</div>
            <div class="mt-2 break-all text-base font-semibold text-[#17201b]">{{ $workspace->brand_url }}</div>
        </div>
        <div class="rounded-lg border border-[#d8dfd9] bg-white p-5">
            <div class="text-sm font-semibold text-[#64716a]">{{ __('customer.current_status') }}</div>
            <div class="mt-2 text-base font-semibold text-[#17201b]">
                @if($workspace->status === 'diagnosis_setup_failed')
                    {{ __('customer.diagnosis_setup_failed') }}
                @elseif($workspace->status === 'diagnosis_failed')
                    {{ __('customer.diagnosis_failed') }}
                @else
                    {{ __('customer.waiting_results') }}
                @endif
            </div>
        </div>
        <div class="rounded-lg border border-[#d8dfd9] bg-white p-5">
            <div class="text-sm font-semibold text-[#64716a]">{{ __('customer.test_batch') }}</div>
            <div class="mt-2 break-all text-base font-semibold text-[#17201b]">{{ $workspace->aivgl_tracking_run_id ?: __('customer.creating') }}</div>
        </div>
    </div>

    @if($workspace->last_error)
        <div class="mt-6 rounded-lg border border-[#f5c2c7] bg-[#fff5f5] p-4 text-sm leading-6 text-[#b42318]">
            {{ $workspace->last_error }}
        </div>
    @endif
</section>
@endsection

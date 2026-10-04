@extends('customer.layouts.app')

@section('content')
    <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
            <a href="{{ route('customer.dashboard') }}" class="inline-flex items-center gap-2 text-sm font-semibold text-[#53725d] hover:text-[#17201b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#53725d]">
                <i data-lucide="arrow-left" class="h-4 w-4" aria-hidden="true"></i>
                {{ __('customer.lp_back_workspace') }}
            </a>
            <p class="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#64716a]">{{ __('customer.lp_archive_label') }}</p>
            <h1 class="mt-2 font-serif text-3xl font-semibold tracking-[-0.025em] text-[#17201b] sm:text-4xl">{{ __('customer.lp_page_title') }}</h1>
        </div>
        <p class="max-w-xl text-sm leading-6 text-[#64716a]">{{ __('customer.lp_page_detail') }}</p>
    </div>

    @if(($launchPackMissingEntitlement ?? false) === true)
        <div class="mb-5 rounded-lg border border-[#e6cf9b] bg-[#fffaf0] px-5 py-4 text-sm leading-6 text-[#73521b]" role="status">
            <p class="font-semibold">{{ __('customer.lp_no_entitlement_title') }}</p>
            <p class="mt-1">{{ __('customer.lp_no_entitlement_detail') }}</p>
        </div>
    @endif

    @include('customer.partials.launch-pack-delivery', [
        'launchPackStatus' => $launchPackStatus ?? $launchPackData ?? [],
        'launchPack' => $launchPack ?? [],
        'launchPackStandalone' => true,
    ])
@endsection

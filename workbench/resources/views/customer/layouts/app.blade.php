@php
    $customerMenu = [
        'dashboard' => ['label' => __('customer.nav_overview'), 'href' => route('customer.dashboard')],
        'deliverables' => ['label' => __('customer.nav_deliverables'), 'href' => route('customer.launch-pack.show')],
        'opportunities' => ['label' => __('customer.nav_problems'), 'href' => route('customer.dashboard').'#problems'],
        'campaigns' => ['label' => __('customer.nav_content'), 'href' => route('customer.campaigns.create')],
        'visibility' => ['label' => __('customer.nav_scores'), 'href' => route('customer.dashboard').'#score-detail'],
        'billing' => ['label' => __('customer.nav_billing'), 'href' => route('customer.dashboard').'#billing-addons'],
    ];
    $customerLocales = ['zh_CN' => '中文', 'en' => 'EN', 'ja' => '日本語'];
@endphp
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@if(isset($pageTitle) && $pageTitle !== ''){{ $pageTitle }} — @endif CowTech</title>
    <link rel="stylesheet" href="{{ asset('css/tailwind.css') }}?v={{ filemtime(public_path('css/tailwind.css')) }}">
    <script src="{{ asset('js/lucide.min.js') }}"></script>
    <style>
        :root {
            --ink: #17201b;
            --muted: #64716a;
            --line: #d8dfd9;
            --paper: #fbfcf8;
            --panel: #ffffff;
            --moss: #385642;
            --signal: #0f766e;
            --amber: #b7791f;
            --blue: #255a8a;
        }
        body {
            background:
                linear-gradient(90deg, rgba(23, 32, 27, 0.035) 1px, transparent 1px),
                linear-gradient(180deg, rgba(23, 32, 27, 0.035) 1px, transparent 1px),
                var(--paper);
            background-size: 32px 32px;
            color: var(--ink);
            font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
            overflow-x: hidden;
        }
        html { scrollbar-gutter: stable; }
        .cowtech-shell {
            font-family: "Aptos", "Segoe UI", sans-serif;
        }
        .customer-panel {
            background: rgba(255, 255, 255, 0.92);
            border: 1px solid var(--line);
            border-radius: 8px;
            box-shadow: 0 18px 40px rgba(23, 32, 27, 0.06);
            min-width: 0;
            overflow-wrap: anywhere;
        }
        .customer-rule {
            background: repeating-linear-gradient(90deg, rgba(56, 86, 66, 0.22), rgba(56, 86, 66, 0.22) 8px, transparent 8px, transparent 16px);
        }
        :focus-visible {
            outline: 2px solid var(--signal);
            outline-offset: 3px;
        }
        .customer-scroll {
            max-width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
        }
        .customer-z-dropdown { z-index: 1000; }
        .customer-z-sticky { z-index: 1100; }
        .customer-z-skip { z-index: 1400; }
        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
                scroll-behavior: auto !important;
                transition-duration: 0.01ms !important;
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
            }
        }
    </style>
    @stack('styles')
</head>
<body>
    <a href="#main-content" class="customer-z-skip sr-only fixed left-4 top-4 rounded-md bg-white px-4 py-3 text-sm font-semibold text-[#17201b] shadow-lg focus:not-sr-only">
        {{ __('customer.skip_to_content') }}
    </a>
    <div class="cowtech-shell min-h-dvh">
        <header class="customer-z-sticky sticky top-0 border-b border-[#d8dfd9] bg-[#fbfcf8]/95 backdrop-blur">
            <div class="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
                <a href="{{ route('customer.dashboard') }}" class="flex shrink-0 items-center gap-3">
                    <img src="{{ asset('assets/img/logo-cowtech.png') }}" alt="CowTech" class="h-9 w-auto">
                    <span class="hidden text-sm font-semibold tracking-normal text-[#385642] sm:inline">{{ __('customer.workspace') }}</span>
                </a>
                <nav class="hidden min-w-0 flex-1 items-center gap-1 md:flex">
                    @foreach ($customerMenu as $key => $item)
                        <a href="{{ $item['href'] }}" class="rounded-md px-3 py-2 text-sm font-medium transition @if(($activeMenu ?? '') === $key) bg-[#e6eee7] text-[#17201b] @else text-[#64716a] hover:bg-white hover:text-[#17201b] @endif">
                            {{ $item['label'] }}
                        </a>
                    @endforeach
                </nav>
                <div class="ml-auto flex shrink-0 items-center gap-2">
                    <details class="relative">
                        <summary class="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md border border-[#d8dfd9] bg-white px-3 text-sm font-semibold text-[#385642] hover:bg-[#f3f7f1]" aria-label="{{ __('customer.language') }}">
                            <i data-lucide="languages" class="h-4 w-4" aria-hidden="true"></i>
                            <span>{{ $customerLocales[app()->getLocale()] ?? 'EN' }}</span>
                        </summary>
                        <div class="customer-z-dropdown absolute right-0 top-[calc(100%+8px)] min-w-36 rounded-lg border border-[#d8dfd9] bg-white p-1 shadow-xl">
                            @foreach($customerLocales as $localeCode => $localeLabel)
                                <a href="{{ route('admin.locale.switch', ['locale' => $localeCode]) }}" hreflang="{{ str_replace('_', '-', $localeCode) }}" class="flex min-h-11 items-center rounded-md px-3 text-sm font-medium @if(app()->getLocale() === $localeCode) bg-[#e6eee7] text-[#17201b] @else text-[#64716a] hover:bg-[#f3f7f1] @endif">
                                    {{ $localeLabel }}
                                </a>
                            @endforeach
                        </div>
                    </details>
                    <form method="POST" action="{{ route('admin.logout') }}">
                        @csrf
                        <button type="submit" class="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-[#d8dfd9] bg-white p-2 text-[#64716a] hover:text-[#17201b]" title="{{ __('customer.logout') }}" aria-label="{{ __('customer.logout') }}">
                            <i data-lucide="log-out" class="h-4 w-4"></i>
                        </button>
                    </form>
                </div>
            </div>
            <nav aria-label="{{ __('customer.menu') }}" class="customer-scroll border-t border-[#d8dfd9] px-4 py-2 md:hidden">
                <div class="mx-auto flex w-max min-w-full gap-1">
                    @foreach ($customerMenu as $key => $item)
                        <a href="{{ $item['href'] }}" class="flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm font-medium @if(($activeMenu ?? '') === $key) bg-[#e6eee7] text-[#17201b] @else text-[#64716a] hover:bg-white hover:text-[#17201b] @endif">
                            {{ $item['label'] }}
                        </a>
                    @endforeach
                </div>
            </nav>
        </header>

        <main id="main-content" tabindex="-1" class="mx-auto min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            @if (session('message'))
                <div class="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    {{ session('message') }}
                </div>
            @endif
            @if ($errors->any())
                <div role="alert" class="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <ul class="space-y-1">
                        @foreach ($errors->all() as $err)
                            <li>{{ $err }}</li>
                        @endforeach
                    </ul>
                </div>
            @endif
            @yield('content')
        </main>
    </div>
    <script>
        if (window.lucide) {
            window.lucide.createIcons();
        }
    </script>
    @stack('scripts')
</body>
</html>

{{-- Modified for CowTech GEO: replace browser compiler with production CSS. Upstream attribution retained. --}}

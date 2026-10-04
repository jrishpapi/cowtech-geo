<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enter reset code — CowTech</title>
    <link rel="stylesheet" href="{{ asset('css/tailwind.css') }}?v={{ filemtime(public_path('css/tailwind.css')) }}">
</head>
<body class="min-h-screen bg-gray-100 flex items-center justify-center px-4">
<main class="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl">
    <h1 class="text-2xl font-bold text-gray-900">Enter your reset code</h1>
    <p class="mt-2 text-sm text-gray-600">The six-digit code expires after 10 minutes.</p>
    @if (session('message'))<div role="status" class="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{{ session('message') }}</div>@endif
    @if ($errors->any())<div role="alert" class="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{{ $errors->first() }}</div>@endif
    <form method="POST" action="{{ route('customer.password.update') }}" class="mt-6 space-y-4">
        @csrf
        <div><label for="email" class="block text-sm font-medium text-gray-700">Email</label><input id="email" name="email" type="email" autocomplete="email" required value="{{ old('email', $email) }}" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 focus:ring-2 focus:ring-blue-500"></div>
        <div><label for="code" class="block text-sm font-medium text-gray-700">Six-digit code</label><input id="code" name="code" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 tracking-widest focus:ring-2 focus:ring-blue-500"></div>
        <div><label for="password" class="block text-sm font-medium text-gray-700">New password</label><input id="password" name="password" type="password" minlength="8" autocomplete="new-password" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 focus:ring-2 focus:ring-blue-500"></div>
        <div><label for="password_confirmation" class="block text-sm font-medium text-gray-700">Confirm new password</label><input id="password_confirmation" name="password_confirmation" type="password" minlength="8" autocomplete="new-password" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 focus:ring-2 focus:ring-blue-500"></div>
        <button class="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700">Reset password</button>
    </form>
</main>
</body></html>

{{-- Modified for CowTech GEO: replace browser compiler with production CSS. Upstream attribution retained. --}}

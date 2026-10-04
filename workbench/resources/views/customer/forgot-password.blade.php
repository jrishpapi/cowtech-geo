<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset password — CowTech</title>
    <link rel="stylesheet" href="{{ asset('css/tailwind.css') }}?v={{ filemtime(public_path('css/tailwind.css')) }}">
</head>
<body class="min-h-screen bg-gray-100 flex items-center justify-center px-4">
<main class="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl">
    <h1 class="text-2xl font-bold text-gray-900">Reset your password</h1>
    <p class="mt-2 text-sm text-gray-600">Enter the email attached to your paid CowTech customer account.</p>
    @if ($errors->any())<div role="alert" class="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{{ $errors->first() }}</div>@endif
    <form method="POST" action="{{ route('customer.password.email') }}" class="mt-6 space-y-5">
        @csrf
        <div><label for="email" class="block text-sm font-medium text-gray-700">Email</label><input id="email" name="email" type="email" autocomplete="email" required value="{{ old('email') }}" class="mt-2 w-full rounded-lg border border-gray-300 px-3 py-3 focus:ring-2 focus:ring-blue-500"></div>
        <button class="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700">Send reset code</button>
    </form>
    <a href="{{ route('admin.login') }}" class="mt-5 block text-center text-sm text-blue-600">Back to login</a>
</main>
</body></html>

{{-- Modified for CowTech GEO: replace browser compiler with production CSS. Upstream attribution retained. --}}

"use client";



import React, { useState, useEffect, useCallback } from "react";



type Props = {

label: string;

value: string;

onChange: (value: string) => void;

onError: (error: string | null) => void; // New: Dispatch errors to parent

id: string; // Ensure unique ID

};



const JsonEditor: React.FC<Props> = ({ label, value, onChange, onError, id }) => {

const [localError, setLocalError] = useState<string | null>(null);



// Real-time JSON validation

const validateJson = useCallback((input: string) => {

try {

if (!input) return null; // Empty is valid (will use [])

const parsed = JSON.parse(input);

if (!Array.isArray(parsed)) throw new Error(`${label} must be an array`);

return null;

} catch (e) {

return (e as Error).message;

}

}, [label]);



useEffect(() => {

const error = validateJson(value);

setLocalError(error);

onError(error); // Sync with parent

}, [value, onError, validateJson]);



// Format JSON button

const handleFormat = () => {

try {

const parsed = JSON.parse(value || "[]");

onChange(JSON.stringify(parsed, null, 2));

setLocalError(null);

onError(null);

} catch {

setLocalError("Invalid JSON - cannot format");

onError("Invalid JSON - cannot format");

}

};



return (

<div className="relative">

<label htmlFor={id} className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">

{label}

</label>

<div className="relative">

<textarea

id={id}

value={value}

onChange={(e) => onChange(e.target.value)}

rows={6}

className={`w-full p-2 font-mono text-xs border rounded-md shadow-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 ${

localError

? "border-red-500 focus:ring-red-500"

: "border-gray-300 dark:border-gray-700 focus:ring-purple-500"

}`}

aria-invalid={!!localError}

aria-describedby={`${id}-error`}

/>

<button

type="button"

onClick={handleFormat}

className="absolute px-2 py-1 text-xs text-purple-600 bg-purple-100 rounded top-2 right-2 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-300 dark:hover:bg-purple-800"

aria-label={`Format ${label} JSON`}

>

Format

</button>

</div>

{localError && (

<p id={`${id}-error`} className="mt-1 text-xs text-red-500">

{localError}

</p>

)}

<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">

{value.length} caractères

</p>

</div>

);

};



export default JsonEditor;
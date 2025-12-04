# Form Field Configuration Guide

## Overview
The chat widget now supports flexible form field configuration with optional and required fields. You can control which fields to show and whether they should be required or optional.

## Configuration Formats

### 1. Simple String Format (Backward Compatible)
If you provide a string, the field will be **shown and required** by default:

```javascript
window.vionikoaiChat = {
  name: "Nombre",        // Shown + Required
  email: "Email",        // Shown + Required
  phone: "Whatsapp",     // Shown + Required
  // ... other config
};
```

### 2. Object Format (New - Supports Optional Fields)
Use an object to specify both label and whether the field is required:

```javascript
window.vionikoaiChat = {
  name: {
    label: "Nombre",
    required: false      // Shown but OPTIONAL
  },
  email: {
    label: "Email",
    required: true       // Shown and REQUIRED
  },
  phone: {
    label: "Whatsapp",
    required: false      // Shown but OPTIONAL
  },
  // ... other config
};
```

### 3. Hide a Field Completely
To **not show** a field at all, simply omit it or set it to a falsy value:

```javascript
window.vionikoaiChat = {
  email: "Email",        // Only show email (required)
  // name and phone are not configured, so they won't show
  // ... other config
};
```

## Examples

### Example 1: Only Email Required, Name Optional
```javascript
window.vionikoaiChat = {
  userId: "your-user-id",
  conversationId: "your-conversation-id",
  fileName: "your-file-name",

  // Form fields
  name: { label: "Name", required: false },     // Optional
  email: { label: "Email Address", required: true },  // Required
  // phone is not configured, so it won't appear

  submit: "Start Chat",
  chatName: "Customer Support",
  // ... other settings
};
```

### Example 2: All Fields Optional
```javascript
window.vionikoaiChat = {
  userId: "your-user-id",

  name: { label: "Your Name", required: false },
  email: { label: "Your Email", required: false },
  phone: { label: "Phone Number", required: false },

  submit: "Continue to Chat",
  // ... other settings
};
```

### Example 3: Mixed Format (Backward Compatible)
```javascript
window.vionikoaiChat = {
  userId: "your-user-id",

  name: "Name",  // String format = Required
  email: { label: "Email", required: false },  // Object format = Optional
  phone: { label: "WhatsApp", required: true }, // Object format = Required

  submit: "Submit",
  // ... other settings
};
```

### Example 4: No Form at All
```javascript
window.vionikoaiChat = {
  userId: "your-user-id",

  // Don't configure name, email, or phone
  // Chat will open directly without a form

  chatName: "Anonymous Chat",
  inputPlaceholder: "Type your message...",
  // ... other settings
};
```

### Example 5: Only One Field (Phone for WhatsApp)
```javascript
window.vionikoaiChat = {
  userId: "your-user-id",

  phone: { label: "WhatsApp Number", required: true },
  // Only phone field shown and required

  submit: "Connect",
  chatName: "WhatsApp Support",
  // ... other settings
};
```

## Validation Behavior

### How Validation Works Now:
1. **Only configured fields are validated** - If you don't configure a field, it won't be checked
2. **Required fields must be filled** - Fields with `required: true` (or string format) must have values
3. **Optional fields can be empty** - Fields with `required: false` can be left blank
4. **Only filled values are sent** - Empty optional fields won't be included in the data sent to the backend

### Previous Behavior (FIXED):
- ❌ All three fields were always required if any were present
- ❌ No way to make fields optional
- ❌ Validation checked all fields even if not configured

### New Behavior:
- ✅ Only configured fields are shown
- ✅ Only configured fields are validated
- ✅ Optional fields can be left empty
- ✅ Validation is smart and dynamic

## Migration Guide

### If you're using the old format:
Your existing configuration will **continue to work** exactly as before:

```javascript
// OLD FORMAT (still works)
window.vionikoaiChat = {
  name: "Nombre",
  email: "Email",
  phone: "Whatsapp",
  // ...
};
// All three fields shown and required ✅
```

### To make fields optional:
Simply change from string to object format:

```javascript
// NEW FORMAT (with optional fields)
window.vionikoaiChat = {
  name: { label: "Nombre", required: false },     // Now optional!
  email: { label: "Email", required: true },      // Still required
  phone: { label: "Whatsapp", required: false },  // Now optional!
  // ...
};
```

## Common Use Cases

### Use Case 1: Email-Only Contact Form
```javascript
window.vionikoaiChat = {
  email: "Your Email Address",  // Only this field will appear
  submit: "Start Chatting",
  // ...
};
```

### Use Case 2: Optional Contact Info
```javascript
window.vionikoaiChat = {
  name: { label: "Name (optional)", required: false },
  email: { label: "Email (optional)", required: false },
  phone: { label: "Phone (optional)", required: false },
  submit: "Continue",
  // Users can skip all fields and chat anonymously
};
```

### Use Case 3: Name Required, Contact Optional
```javascript
window.vionikoaiChat = {
  name: "Full Name",  // Required
  email: { label: "Email (optional)", required: false },
  phone: { label: "Phone (optional)", required: false },
  submit: "Start Chat",
  // Only name is mandatory
};
```

## Technical Details

### Field Processing:
- Fields are processed in order: `name`, `email`, `phone`
- Only configured fields are rendered in the form
- HTML5 validation is used for required fields (`required` attribute)
- Email field automatically gets `type="email"` for format validation

### Data Storage:
- Only fields with values are stored in `window.vionikoaiChat`
- Empty optional fields are not included in the stored data
- The `chatId` is generated when the form is successfully submitted

### Browser Support:
- Works in all modern browsers
- Uses HTML5 form validation
- Gracefully handles missing or undefined field configurations

## Troubleshooting

### Form not appearing?
- Check that at least one field is configured
- Ensure field values are truthy (not `null`, `undefined`, or empty string)

### Field always required?
- If using string format, it will be required by default
- To make optional, use object format: `{ label: "...", required: false }`

### Validation not working?
- Check browser console for errors
- Ensure field configurations are properly formatted
- Verify that `required` is explicitly set to `false` for optional fields

# Cloudinary Image Upload Setup

This application uses **Cloudinary** for image storage instead of local file uploads.

## Setup Instructions

### 1. Create a Cloudinary Account
1. Go to [https://cloudinary.com](https://cloudinary.com)
2. Sign up for a free account
3. Navigate to your Dashboard

### 2. Get Your Credentials
From your Cloudinary Dashboard, copy:
- **Cloud Name**
- **API Key**
- **API Secret**

### 3. Configure Environment Variables
Add these to your `.env` file:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=foodmonk
```

### 4. Features

#### Automatic Image Optimization
- Images are automatically resized to max 1000x1000 pixels
- Maintains aspect ratio with 'limit' crop mode
- Reduces file size and bandwidth

#### Supported Formats
- JPG/JPEG
- PNG
- GIF
- WebP

#### File Size Limit
- Maximum: 5MB (configurable via `MAX_FILE_SIZE` in .env)

#### Automatic Cleanup
- Old images are automatically deleted when:
  - Updating food/restaurant image
  - Deleting food item
  - Deleting restaurant logo

### 5. API Endpoints That Use Image Upload

#### Food Images
```bash
# Create food with image
POST /api/foods
Content-Type: multipart/form-data
Authorization: Bearer {token}

Form Data:
- name: "Burger"
- description: "Delicious burger"
- price: 500
- category: "Main Course"
- image: [file]

# Update food image
PUT /api/foods/:id
Content-Type: multipart/form-data
Authorization: Bearer {token}

Form Data:
- image: [file]
```

#### Restaurant Logo
```bash
# Upload restaurant logo
POST /api/restaurant/logo
Content-Type: multipart/form-data
Authorization: Bearer {token}

Form Data:
- logo: [file]

# Delete restaurant logo
DELETE /api/restaurant/logo
Authorization: Bearer {token}
```

### 6. Response Format

When an image is uploaded, Cloudinary returns a URL like:
```
https://res.cloudinary.com/your_cloud_name/image/upload/v1234567890/foodmonk/abc123def456.jpg
```

This URL is stored in the database and can be accessed directly from anywhere.

### 7. Benefits Over Local Storage

✅ **CDN Delivery**: Images served from Cloudinary's global CDN
✅ **Automatic Optimization**: Images optimized for web delivery
✅ **Transformations**: Can apply transformations via URL parameters
✅ **No Server Storage**: Saves server disk space
✅ **Scalability**: No storage limits (within plan)
✅ **Backup**: Cloudinary handles backups automatically

### 8. Free Tier Limits

- 25 GB storage
- 25 GB monthly bandwidth
- 25,000 transformations/month

Perfect for development and small to medium applications!

### 9. Folder Structure

All images are stored in the folder specified by `CLOUDINARY_FOLDER` (default: "foodmonk")

Structure:
```
foodmonk/
  ├── food-image-1.jpg
  ├── food-image-2.png
  ├── restaurant-logo-1.jpg
  └── ...
```

### 10. Testing

After setup, test image upload:

```bash
# Create a test food item with image
curl -X POST http://localhost:7878/api/foods \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "name=Test Food" \
  -F "price=100" \
  -F "category=Test" \
  -F "image=@/path/to/image.jpg"

# Response will include Cloudinary URL in image field
{
  "success": true,
  "data": {
    "food": {
      "name": "Test Food",
      "image": "https://res.cloudinary.com/your_cloud/image/upload/v123/foodmonk/abc.jpg"
    }
  }
}
```

### 11. Migration from Local Storage

If you have existing images in the `uploads/` folder:

1. Images are now stored on Cloudinary
2. Old local images can be safely deleted
3. Database records will be updated with Cloudinary URLs on next upload
4. No data migration needed - new uploads automatically use Cloudinary

### 12. Troubleshooting

**Error: "Invalid credentials"**
- Check your CLOUDINARY_CLOUD_NAME, API_KEY, and API_SECRET
- Ensure no extra spaces in .env file

**Error: "Upload failed"**
- Check file size (must be under 5MB)
- Verify file format (jpg, png, gif, webp only)
- Check Cloudinary account status

**Images not loading**
- Verify the Cloudinary URL is accessible
- Check if your Cloudinary account is active
- Ensure images haven't been deleted from Cloudinary dashboard

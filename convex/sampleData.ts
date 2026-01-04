import { mutation, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const clearAndCreateSampleData = mutation({
  args: {},
  handler: async (ctx) => {
    // PRODUCTION SAFETY: Only allow sample data creation in local development
    const isDev = process.env.CONVEX_CLOUD_URL?.includes("convex.cloud") === false;
    if (!isDev) {
      throw new Error("Sample data creation is only allowed in local development mode");
    }

    // Clear existing data
    const existingAds = await ctx.db.query("ads").collect();
    for (const ad of existingAds) {
      await ctx.db.delete(ad._id);
    }

    const existingCategories = await ctx.db.query("categories").collect();
    for (const category of existingCategories) {
      await ctx.db.delete(category._id);
    }

    // Try to get authenticated user, but don't require it for sample data
    let currentUserId = await getAuthUserId(ctx);

    // Create multiple sample users for realistic test data
    const sampleUsers = [
      { name: "Sarah Chen", email: "sarah.chen@example.com" },
      { name: "Mike Johnson", email: "mike.j@example.com" },
      { name: "Emma Wilson", email: "emma.w@example.com" },
      { name: "David Park", email: "david.park@example.com" },
      { name: "Lisa Brown", email: "lisa.brown@example.com" },
    ];

    const userIds: any[] = [];
    for (const userData of sampleUsers) {
      const userId = await ctx.db.insert("users", {
        name: userData.name,
        email: userData.email,
        emailVerificationTime: Date.now(),
        isAnonymous: false,
        totalRating: Math.floor(Math.random() * 20),
        ratingCount: Math.floor(Math.random() * 10),
        averageRating: Math.round((3 + Math.random() * 2) * 10) / 10, // 3.0-5.0 rating
        isVerified: Math.random() > 0.5,
      });
      userIds.push(userId);
    }

    // Create English categories with Lucide icon names
    const categories = [
      { name: "Vehicles", slug: "vehicles", icon: "Car" },
      { name: "Real Estate", slug: "real-estate", icon: "Home" },
      { name: "Electronics", slug: "electronics", icon: "Smartphone" },
      { name: "Home & Garden", slug: "home-garden", icon: "Armchair" },
      { name: "Services", slug: "services", icon: "Wrench" },
      { name: "Fashion", slug: "fashion", icon: "Shirt" },
      { name: "Sports & Recreation", slug: "sports", icon: "Dumbbell" },
      { name: "Gigs & Temp Work", slug: "gigs-temp-work", icon: "Briefcase" },
      { name: "Personal Items", slug: "personal-items", icon: "Watch" },
      { name: "Books & Media", slug: "books-media", icon: "Book" },
      { name: "Pets & Animals", slug: "pets-animals", icon: "PawPrint" },
      { name: "Art", slug: "art", icon: "Palette" },
      { name: "Equipment Rental", slug: "equipment-rental", icon: "CalendarClock" },
      { name: "Baby & Kids", slug: "baby-kids", icon: "Baby" },
    ];

    const categoryIds = [];
    for (const category of categories) {
      const id = await ctx.db.insert("categories", category);
      categoryIds.push(id);
    }

    // Create sample ads with multiple images
    const sampleAds = [
      {
        title: "2020 Toyota Camry Hybrid - Excellent Condition",
        description: "Pristine Toyota Camry Hybrid with leather seats, navigation system, and comprehensive service history. One careful owner.",
        extendedDescription: "This beautiful Toyota Camry Hybrid comes with premium leather interior, heated seats, dual-zone climate control, and advanced safety features including lane departure warning and automatic emergency braking. Recently serviced with new tyres.",
        price: 32900,
        location: "Sydney, CBD",
        latitude: -33.8688,
        longitude: 151.2093,
        categoryId: categoryIds[0],
        images: [
          "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1542362567-b07e54358753?w=800&h=600&fit=crop"
        ],
        userId: userIds[0], // Sarah Chen
        isActive: true,
        views: 127,
      },
      {
        title: "Luxury 3BR Penthouse with Harbour Views",
        description: "Stunning penthouse apartment featuring panoramic harbour views, marble kitchen, rooftop terrace, and premium finishes.",
        extendedDescription: "This exceptional penthouse offers 180-degree harbour views from every room. Features include Italian marble throughout, Miele appliances, wine cellar, private lift access, and a 100sqm rooftop terrace with outdoor kitchen.",
        price: 1200,
        location: "Sydney, Northern Beaches",
        latitude: -33.7969,
        longitude: 151.2846,
        categoryId: categoryIds[1],
        images: [
          "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&h=600&fit=crop"
        ],
        userId: userIds[1], // Mike Johnson
        isActive: true,
        views: 289,
      },
      {
        title: "MacBook Pro M3 16-inch - Brand New Sealed",
        description: "Latest MacBook Pro with M3 chip, 16GB RAM, 512GB SSD. Still sealed in original packaging with full Apple warranty.",
        extendedDescription: "Brand new MacBook Pro 16-inch with the powerful M3 Pro chip, 16GB unified memory, and 512GB SSD storage. Features the stunning Liquid Retina XDR display, advanced camera and audio, and all-day battery life.",
        price: 3499,
        location: "Melbourne, CBD",
        latitude: -37.8136,
        longitude: 144.9631,
        categoryId: categoryIds[2],
        images: [
          "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1484788984921-03950022c9ef?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800&h=600&fit=crop"
        ],
        userId: userIds[2], // Emma Wilson
        isActive: true,
        views: 203,
      },
      {
        title: "Vintage Leather Sofa Set - 3 Piece",
        description: "Beautiful vintage brown leather sofa set including 3-seater, 2-seater, and armchair. Excellent condition with rich patina.",
        extendedDescription: "This stunning vintage leather furniture set features genuine top-grain leather with beautiful aging. The set includes a 3-seater sofa, 2-seater loveseat, and matching armchair. Perfect for creating a sophisticated living space.",
        price: 2800,
        location: "Brisbane, South Bank",
        latitude: -27.4705,
        longitude: 153.0260,
        categoryId: categoryIds[3],
        images: [
          "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=800&h=600&fit=crop"
        ],
        userId: userIds[3], // David Park
        isActive: true,
        views: 156,
      },
      {
        title: "iPhone 15 Pro Max 256GB - Space Black",
        description: "Brand new iPhone 15 Pro Max in Space Black, 256GB storage. Unopened box with full warranty and all accessories included.",
        extendedDescription: "Latest iPhone 15 Pro Max featuring the powerful A17 Pro chip, advanced camera system with 5x telephoto zoom, and titanium design. Includes original box, charging cable, and documentation. Never used, still sealed.",
        price: 1899,
        location: "Perth, Fremantle",
        latitude: -32.0569,
        longitude: 115.7439,
        categoryId: categoryIds[2],
        images: [
          "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1580910051074-3eb694886505?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?w=800&h=600&fit=crop"
        ],
        userId: userIds[4], // Lisa Brown
        isActive: true,
        views: 342,
      },
      {
        title: "Mountain Bike - Trek X-Caliber 8",
        description: "Excellent condition Trek X-Caliber 8 mountain bike. Perfect for trails and city riding. Recently serviced with new components.",
        extendedDescription: "This Trek X-Caliber 8 features a lightweight aluminum frame, 29-inch wheels, and reliable Shimano components. Recently had a full service including new brake pads, chain, and tune-up. Great for both mountain trails and urban commuting.",
        price: 1250,
        location: "Adelaide, CBD",
        latitude: -34.9285,
        longitude: 138.6007,
        categoryId: categoryIds[6],
        images: [
          "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1502744688674-c619d1586c9e?w=800&h=600&fit=crop"
        ],
        userId: userIds[0], // Sarah Chen
        isActive: true,
        views: 89,
      },
      {
        title: "Designer Handbag - Authentic Louis Vuitton",
        description: "Authentic Louis Vuitton Neverfull MM in Damier Ebene canvas. Excellent condition with minimal wear. Includes dust bag and authenticity card.",
        extendedDescription: "This timeless Louis Vuitton Neverfull MM is perfect for everyday use. Features the iconic Damier Ebene canvas, natural cowhide leather trim, and gold-tone hardware. Interior has red Alcantara lining. Purchased from official LV store.",
        price: 1200,
        location: "Melbourne, South Yarra",
        latitude: -37.8386,
        longitude: 144.9944,
        categoryId: categoryIds[5],
        images: [
          "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&h=600&fit=crop"
        ],
        userId: userIds[1], // Mike Johnson
        isActive: true,
        views: 78,
      },
      {
        title: "Freelance Web Developer Available",
        description: "Experienced full-stack developer available for short-term projects. Specializing in React, Node.js, and modern web technologies.",
        extendedDescription: "Professional web developer with 5+ years experience in building responsive websites and web applications. Available for freelance work on projects ranging from 1 week to 3 months. Portfolio includes e-commerce sites, corporate websites, and custom web applications.",
        price: 85,
        location: "Sydney, CBD",
        latitude: -33.8688,
        longitude: 151.2093,
        categoryId: categoryIds[7],
        images: [
          "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1517180102446-f3ece451e9d8?w=800&h=600&fit=crop"
        ],
        userId: userIds[2], // Emma Wilson
        isActive: true,
        views: 45,
      },
      {
        title: "Vintage Vinyl Record Collection",
        description: "Rare collection of vintage vinyl records from the 60s-80s. Includes Beatles, Pink Floyd, Led Zeppelin, and more classic rock albums.",
        extendedDescription: "Carefully curated collection of over 50 vintage vinyl records in excellent condition. All records have been stored properly and play without issues. Includes original sleeves and some rare first pressings. Perfect for collectors or music enthusiasts.",
        price: 850,
        location: "Melbourne, Fitzroy",
        latitude: -37.7964,
        longitude: 144.9784,
        categoryId: categoryIds[8],
        images: [
          "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=600&fit=crop"
        ],
        userId: userIds[3], // David Park
        isActive: true,
        views: 92,
      },
      {
        title: "Complete Harry Potter Book Set - First Editions",
        description: "Complete set of Harry Potter books, first edition hardcovers in pristine condition. All seven books included with dust jackets.",
        extendedDescription: "Rare complete set of Harry Potter first edition hardcover books. All books are in excellent condition with original dust jackets intact. Perfect for collectors or as a special gift for Harry Potter fans. Books have been stored in protective sleeves.",
        price: 2400,
        location: "Brisbane, New Farm",
        latitude: -27.4689,
        longitude: 153.0515,
        categoryId: categoryIds[9],
        images: [
          "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&h=600&fit=crop"
        ],
        userId: userIds[4], // Lisa Brown
        isActive: true,
        views: 156,
      },
      {
        title: "Golden Retriever Puppies - Purebred",
        description: "Adorable Golden Retriever puppies ready for their forever homes. Vaccinated, microchipped, and health checked by vet.",
        extendedDescription: "Beautiful litter of Golden Retriever puppies from champion bloodlines. All puppies have been vaccinated, microchipped, and health checked. Parents are both on-site and have excellent temperaments. Puppies are well-socialized and ready to go to loving homes.",
        price: 1800,
        location: "Perth, Joondalup",
        latitude: -31.7448,
        longitude: 115.7661,
        categoryId: categoryIds[10],
        images: [
          "https://images.unsplash.com/photo-1552053831-71594a27632d?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=800&h=600&fit=crop"
        ],
        userId: userIds[0], // Sarah Chen
        isActive: true,
        views: 234,
      }
    ];

    for (const ad of sampleAds) {
      await ctx.db.insert("ads", ad);
    }

    return "Sample data created successfully";
  },
});

export const scrapeCategories = action({
  args: {},
  handler: async () => {
    try {
      const response = await fetch("https://divar.ir/s/tehran", {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();

      // Look for category data in the HTML
      return {
        success: true,
        htmlLength: html.length,
        preview: html.substring(0, 2000)
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  },
});

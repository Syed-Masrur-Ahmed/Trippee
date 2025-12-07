import { createClient } from '@/lib/supabase/server';
import { createClient as createClientJS } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  
  // Dual authentication: try token-based first, fallback to cookie-based
  let supabase;
  const authHeader = request.headers.get('Authorization');
  
  if (authHeader) {
    supabase = createClientJS(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: authHeader } },
      }
    );
  } else {
    supabase = await createClient();
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch trip data
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id, name, start_date, end_date, trip_days')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Debug: Log trip data to verify start_date is present
    console.log('Trip data for PDF:', {
      id: trip.id,
      name: trip.name,
      start_date: trip.start_date,
      end_date: trip.end_date,
      trip_days: trip.trip_days,
    });

    // Fetch places
    const { data: places, error: placesError } = await supabase
      .from('places')
      .select('id, name, lat, lng, category, day_assigned, order_index, address, notes')
      .eq('trip_id', tripId)
      .order('day_assigned', { ascending: true, nullsFirst: false })
      .order('order_index', { ascending: true, nullsFirst: false });

    if (placesError) {
      return NextResponse.json({ error: 'Failed to load places' }, { status: 500 });
    }

    // Group places by day
    const placesByDay: Record<number, typeof places> = {};
    const unassignedPlaces = places?.filter((p) => !p.day_assigned) || [];

    places?.forEach((place) => {
      if (place.day_assigned) {
        if (!placesByDay[place.day_assigned]) {
          placesByDay[place.day_assigned] = [];
        }
        placesByDay[place.day_assigned].push(place);
      }
    });

    // Sort places within each day by order_index
    Object.keys(placesByDay).forEach((day) => {
      placesByDay[Number(day)].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    });

    // Generate PDF using jsPDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    });

    // Helper function to format date
    function formatDate(dateString: string | null): string {
      if (!dateString) return 'Not set';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }

    // Helper function to calculate date for a day
    function getDateForDay(day: number): string {
      if (!trip.start_date) {
        return '';
      }
      
      try {
        // Parse the date string (format: YYYY-MM-DD from PostgreSQL DATE type)
        // Handle both date-only strings and datetime strings
        let dateStr = trip.start_date;
        if (dateStr.includes('T')) {
          // If it includes time, extract just the date part
          dateStr = dateStr.split('T')[0];
        }
        
        const [year, month, dayOfMonth] = dateStr.split('-').map(Number);
        
        // Create date object (using local timezone, but date-only so no timezone shift)
        const startDate = new Date(year, month - 1, dayOfMonth);
        
        // Calculate the date for this day
        const dayDate = new Date(startDate);
        dayDate.setDate(startDate.getDate() + (day - 1));
        
        // Format the date
        const weekday = dayDate.toLocaleDateString('en-US', { weekday: 'long' });
        const formattedDate = dayDate.toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric',
          year: 'numeric'
        });
        
        return `${weekday}, ${formattedDate}`;
      } catch (error) {
        console.error('Error formatting date for day', day, ':', error);
        return '';
      }
    }

    let yPosition = 20; // Starting Y position
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    const lineHeight = 7;
    const maxWidth = pageWidth - (margin * 2);

    // Helper to check if we need a new page
    function checkNewPage(spaceNeeded: number) {
      if (yPosition + spaceNeeded > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    }

    // Header
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    const titleWidth = doc.getTextWidth(trip.name);
    doc.text(trip.name, (pageWidth - titleWidth) / 2, yPosition);
    yPosition += 10;

    // Trip dates
    if (trip.start_date || trip.end_date) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      let dateText = '';
      if (trip.start_date && trip.end_date) {
        dateText = `Trip Dates: ${formatDate(trip.start_date)} - ${formatDate(trip.end_date)}`;
      } else if (trip.start_date) {
        dateText = `Start Date: ${formatDate(trip.start_date)}`;
      } else if (trip.end_date) {
        dateText = `End Date: ${formatDate(trip.end_date)}`;
      }
      const dateWidth = doc.getTextWidth(dateText);
      doc.text(dateText, (pageWidth - dateWidth) / 2, yPosition);
      doc.setTextColor(0, 0, 0);
      yPosition += 10;
    }

    // Itinerary by day
    const tripDays = trip.trip_days || Object.keys(placesByDay).length || 1;
    
    for (let day = 1; day <= tripDays; day++) {
      const dayPlaces = placesByDay[day] || [];
      
      if (dayPlaces.length === 0 && day === 1 && Object.keys(placesByDay).length === 0) {
        // Skip empty days if no places are assigned
        continue;
      }

      checkNewPage(15);
      
      // Day header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(74, 85, 104);
      const dateInfo = getDateForDay(day);
      const dayTitle = dateInfo ? `Day ${day} - ${dateInfo}` : `Day ${day}`;
      doc.text(dayTitle, margin, yPosition);
      doc.setTextColor(0, 0, 0);
      yPosition += 8;

      if (dayPlaces.length === 0) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(150, 150, 150);
        doc.text('No places assigned for this day.', margin + 5, yPosition);
        doc.setTextColor(0, 0, 0);
        yPosition += 10;
        continue;
      }

      // Places for this day
      dayPlaces.forEach((place, index) => {
        checkNewPage(20);
        
        // Place number and name
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`${index + 1}. ${place.name}`, margin, yPosition);
        yPosition += 6;

        // Category badge
        if (place.category) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 100, 100);
          doc.text(`[${place.category}]`, margin + 5, yPosition);
          doc.setTextColor(0, 0, 0);
          yPosition += 5;
        }

        // Location coordinates
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`   Location: ${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}`, margin + 5, yPosition);
        yPosition += 5;

        // Address if available
        if (place.address) {
          const addressLines = doc.splitTextToSize(`   Address: ${place.address}`, maxWidth - 10);
          doc.text(addressLines, margin + 5, yPosition);
          yPosition += addressLines.length * 5;
        }

        // Notes if available
        if (place.notes) {
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(85, 85, 85);
          const notesLines = doc.splitTextToSize(`   Notes: ${place.notes}`, maxWidth - 10);
          doc.text(notesLines, margin + 5, yPosition);
          yPosition += notesLines.length * 5;
          doc.setTextColor(0, 0, 0);
        }

        yPosition += 3;
      });
    }

    // Unassigned places (if any)
    if (unassignedPlaces.length > 0) {
      checkNewPage(15);
      
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(74, 85, 104);
      doc.text('Unassigned Places', margin, yPosition);
      doc.setTextColor(0, 0, 0);
      yPosition += 8;

      unassignedPlaces.forEach((place, index) => {
        checkNewPage(15);
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`${index + 1}. ${place.name}`, margin, yPosition);
        yPosition += 6;

        if (place.category) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 100, 100);
          doc.text(`[${place.category}]`, margin + 5, yPosition);
          doc.setTextColor(0, 0, 0);
          yPosition += 5;
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`   Location: ${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}`, margin + 5, yPosition);
        yPosition += 5;

        if (place.address) {
          const addressLines = doc.splitTextToSize(`   Address: ${place.address}`, maxWidth - 10);
          doc.text(addressLines, margin + 5, yPosition);
          yPosition += addressLines.length * 5;
        }

        yPosition += 3;
      });
    }

    // Add footer to all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      const footerText = `Generated by Trippee - ${new Date().toLocaleDateString()}`;
      const footerWidth = doc.getTextWidth(footerText);
      doc.text(footerText, (pageWidth - footerWidth) / 2, pageHeight - 10);
    }

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${trip.name.replace(/[^a-z0-9]/gi, '_')}_itinerary.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}

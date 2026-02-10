"use client"

import { Button } from "@/components/ui/button"

interface ViewReviewsButtonProps {
  className?: string
}

export function ViewReviewsButton({ className }: ViewReviewsButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    
    // Find the reviews section by id
    const reviewsSection = document.getElementById('reviews-section')
    if (!reviewsSection) return
    
    // Find the accordion trigger - it should be a button inside the reviews section
    // Try multiple selectors to find it
    let trigger = reviewsSection.querySelector('button[data-slot="accordion-trigger"]') as HTMLButtonElement
    if (!trigger) {
      trigger = reviewsSection.querySelector('button[type="button"]') as HTMLButtonElement
    }
    if (!trigger) {
      trigger = reviewsSection.querySelector('button') as HTMLButtonElement
    }
    
    if (trigger) {
      // Check if accordion is open
      const isOpen = trigger.getAttribute('data-state') === 'open' ||
                     trigger.closest('[data-state="open"]') !== null
      
      if (!isOpen) {
        // Click the trigger to expand
        trigger.click()
        
        // Wait for accordion animation, then scroll
        setTimeout(() => {
          scrollToReviews()
        }, 350)
      } else {
        // Already open, just scroll
        scrollToReviews()
      }
    } else {
      // No trigger found, just scroll
      scrollToReviews()
    }
  }

  const scrollToReviews = () => {
    const reviewsSection = document.getElementById('reviews-section')
    if (!reviewsSection) return

    // The reviews section is below the main layout, so we need to scroll the page
    // Calculate the position relative to the viewport
    const rect = reviewsSection.getBoundingClientRect()
    const scrollY = window.scrollY + rect.top - 100 // 100px offset from top
    
    window.scrollTo({
      top: scrollY,
      behavior: 'smooth'
    })
  }

  return (
    <Button
      size="lg"
      variant="outline"
      className={className}
      onClick={handleClick}
    >
      Bewertungen
    </Button>
  )
}


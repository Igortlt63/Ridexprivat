'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function DriverVehiclePage() {
  const router = useRouter()
  useEffect(() => { router.replace('/profile/vehicle/new') }, [])
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
    </div>
  )
}

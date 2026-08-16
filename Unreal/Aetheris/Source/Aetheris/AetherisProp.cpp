#include "AetherisProp.h"

AAetherisProp::AAetherisProp()
{
	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);
	PrimaryActorTick.bCanEverTick = false;
}
